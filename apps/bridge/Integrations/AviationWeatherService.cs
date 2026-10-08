using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;

namespace MsfsCompanion.Bridge.Integrations;

public sealed record WeatherReport(string Airport, string? Metar, string? Taf,
    DateTimeOffset FetchedAt, bool Available, string Source);

/// <summary>
/// NOAA AviationWeather worldwide METAR/TAF. No keys, no extra programs.
/// Fetches on explicit HTTP requests, cached per ICAO and bounded for rate limiting.
/// </summary>
public sealed class AviationWeatherService
{
    private static readonly HttpClient Client = CreateClient();
    private readonly ConcurrentDictionary<string, WeatherReport> _reports = new();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTimeOffset _lastGlobalRequest = DateTimeOffset.MinValue;

    private static HttpClient CreateClient()
    {
        var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        { BaseAddress = new Uri("https://aviationweather.gov/api/data/"),
          Timeout = TimeSpan.FromSeconds(10) };
        client.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("MSFS-Companion", "0.2"));
        client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("text/plain"));
        return client;
    }

    public static bool ValidAirport(string? id) =>
        id is { Length: 4 } && id.All(char.IsAsciiLetter) &&
        id.All(c => c is >= 'A' and <= 'Z' or >= 'a' and <= 'z');

    public async Task<WeatherReport?> GetAsync(string airport, CancellationToken ct)
    {
        if (!ValidAirport(airport)) return null;
        airport = airport.ToUpperInvariant();
        if (_reports.TryGetValue(airport, out var cached) &&
            DateTimeOffset.UtcNow - cached.FetchedAt < TimeSpan.FromMinutes(10))
            return cached;
        await _gate.WaitAsync(ct);
        try
        {
            if (_reports.TryGetValue(airport, out cached) &&
                DateTimeOffset.UtcNow - cached.FetchedAt < TimeSpan.FromMinutes(10))
                return cached;
            // One NOAA query batch per 2 seconds per host, avoids hammering the provider.
            var pause = TimeSpan.FromSeconds(2) - (DateTimeOffset.UtcNow - _lastGlobalRequest);
            if (pause > TimeSpan.Zero) await Task.Delay(pause, ct);
            _lastGlobalRequest = DateTimeOffset.UtcNow;
            string? metar = null, taf = null;
            try
            {
                metar = await ReadTextAsync($"metar?ids={airport}&format=raw", ct);
                taf = await ReadTextAsync($"taf?ids={airport}&format=raw", ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException
                or InvalidDataException)
            {
                // Keep a stale successful result when NOAA is temporarily unavailable.
                if (cached is { Available: true }) return cached;
            }
            var available = !string.IsNullOrWhiteSpace(metar) ||
                !string.IsNullOrWhiteSpace(taf);
            var result = new WeatherReport(airport, metar, taf,
                DateTimeOffset.UtcNow, available, "NOAA Aviation Weather Center");
            _reports[airport] = result;
            if (_reports.Count > 80)
                foreach (var pair in _reports.OrderBy(x => x.Value.FetchedAt)
                    .Take(_reports.Count - 60))
                    _reports.TryRemove(pair.Key, out _);
            return result;
        }
        finally { _gate.Release(); }
    }

    private static async Task<string?> ReadTextAsync(string path, CancellationToken ct)
    {
        using var response = await Client.GetAsync(path, HttpCompletionOption.ResponseHeadersRead, ct);
        if (response.StatusCode == HttpStatusCode.NoContent || response.StatusCode == HttpStatusCode.NotFound)
            return null;
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength is > 8192)
            throw new InvalidDataException("Too large NOAA response.");
        var value = await response.Content.ReadAsStringAsync(ct);
        value = value.Trim();
        return value.Length is > 0 and <= 8192 ? value : null;
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
