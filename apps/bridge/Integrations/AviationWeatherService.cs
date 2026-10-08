using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace MsfsCompanion.Bridge.Integrations;

public sealed record WeatherReport(
    string Airport, string? Metar, string? Taf, DateTimeOffset FetchedAt,
    bool Available, string Source, bool Stale = false, string? Error = null);

public readonly record struct WeatherFetch(string? Value, bool Succeeded);

/// <summary>
/// NOAA Aviation Weather METAR/TAF over HTTPS. Separate product failures are
/// isolated: a failed TAF must not discard a freshly fetched METAR.
/// Cached reports are explicitly marked stale when refresh fails.
/// </summary>
public sealed class AviationWeatherService
{
    private static readonly HttpClient Client = CreateClient();
    private readonly ConcurrentDictionary<string, WeatherReport> _reports = new();
    private readonly ConcurrentDictionary<string, DateTimeOffset> _retryAfter = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTimeOffset _lastGlobalRequest = DateTimeOffset.MinValue;
    private const string Provider = "NOAA Aviation Weather Center";

    private static HttpClient CreateClient()
    {
        var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri("https://aviationweather.gov/api/data/"),
            Timeout = TimeSpan.FromSeconds(10)
        };
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("MSFS-Companion", "0.2"));
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("text/plain"));
        return client;
    }

    public static bool ValidAirport(string? id) =>
        id is { Length: 4 } && id.All(c => c is >= 'A' and <= 'Z' or >= 'a' and <= 'z');

    /// <summary>
    /// Deterministic merge for partial data: HTTP 204 is valid empty data,
    /// network errors are not. Do not invent a fresh timestamp for stale fallback.
    /// </summary>
    public static WeatherReport Combine(string airport, WeatherReport? previous,
        WeatherFetch metar, WeatherFetch taf, DateTimeOffset now)
    {
        var failed = !metar.Succeeded || !taf.Succeeded;
        var valueMetar = metar.Succeeded ? metar.Value : previous?.Metar;
        var valueTaf = taf.Succeeded ? taf.Value : previous?.Taf;
        var available = !string.IsNullOrWhiteSpace(valueMetar) ||
            !string.IsNullOrWhiteSpace(valueTaf);
        var fetchedAt = failed && previous is not null ? previous.FetchedAt : now;
        return new WeatherReport(airport, valueMetar, valueTaf, fetchedAt,
            available, Provider, Stale: failed,
            Error: failed ? "Část meteorologických údajů nelze obnovit; případné starší hodnoty zůstaly zachované." : null);
    }

    public async Task<WeatherReport?> GetAsync(string airport, CancellationToken ct)
    {
        if (!ValidAirport(airport)) return null;
        airport = airport.ToUpperInvariant();
        var now = DateTimeOffset.UtcNow;
        if (_reports.TryGetValue(airport, out var cached) &&
            !cached.Stale && now - cached.FetchedAt < TimeSpan.FromMinutes(10))
            return cached;
        if (_retryAfter.TryGetValue(airport, out var retry) && now < retry)
            return cached;

        await _gate.WaitAsync(ct);
        try
        {
            now = DateTimeOffset.UtcNow;
            if (_reports.TryGetValue(airport, out cached) &&
                !cached.Stale && now - cached.FetchedAt < TimeSpan.FromMinutes(10))
                return cached;
            if (_retryAfter.TryGetValue(airport, out retry) && now < retry)
                return cached;

            // Throttle across all clients (iPad, Mac, multiple tabs).
            var wait = TimeSpan.FromSeconds(2) - (now - _lastGlobalRequest);
            if (wait > TimeSpan.Zero) await Task.Delay(wait, ct);
            _lastGlobalRequest = DateTimeOffset.UtcNow;

            var metar = await FetchProductAsync($"metar?ids={airport}&format=raw", ct);
            var taf = await FetchProductAsync($"taf?ids={airport}&format=raw", ct);
            var result = Combine(airport, cached, metar, taf, DateTimeOffset.UtcNow);
            _reports[airport] = result;
            if (result.Stale)
                _retryAfter[airport] = DateTimeOffset.UtcNow.AddMinutes(2);
            else
                _retryAfter.TryRemove(airport, out _);

            if (_reports.Count > 80)
            {
                foreach (var pair in _reports.OrderBy(x => x.Value.FetchedAt)
                             .Take(_reports.Count - 60))
                {
                    _reports.TryRemove(pair.Key, out _);
                    _retryAfter.TryRemove(pair.Key, out _);
                }
            }
            return result;
        }
        finally { _gate.Release(); }
    }

    private static async Task<WeatherFetch> FetchProductAsync(string path, CancellationToken ct)
    {
        try
        {
            return new WeatherFetch(await ReadTextAsync(path, ct), true);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException
            or InvalidDataException)
        {
            return new WeatherFetch(null, false);
        }
    }

    private static async Task<string?> ReadTextAsync(string path, CancellationToken ct)
    {
        using var response = await Client.GetAsync(path,
            HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.NoContent)
            return null; // NOAA HTTP 204 means a valid query with no available report.
        response.EnsureSuccessStatusCode(); // 404/429/5xx are failures, not missing reports.
        const int maximumBytes = 8192;
        if (response.Content.Headers.ContentLength is > maximumBytes)
            throw new InvalidDataException("NOAA response too large.");

        await using var input = await response.Content.ReadAsStreamAsync(ct);
        using var output = new MemoryStream();
        var buffer = new byte[2048];
        int count;
        while ((count = await input.ReadAsync(buffer, ct)) != 0)
        {
            if (output.Length + count > maximumBytes)
                throw new InvalidDataException("NOAA response too large.");
            output.Write(buffer, 0, count);
        }
        var value = Encoding.UTF8.GetString(output.ToArray()).Trim();
        return value.Length == 0 ? null : value;
    }

    public static void MapAviationWeather(WebApplication app)
    {
        app.MapGet("/api/weather/{icao}", async (string icao,
            AviationWeatherService service, CancellationToken ct) =>
        {
            if (!ValidAirport(icao))
                return Results.BadRequest(new { error = "Vyžaduje se čtyřpísmenný ICAO kód." });
            return Results.Ok(await service.GetAsync(icao, ct));
        });
    }
}
