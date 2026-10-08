using System.Net.Http.Headers;
using System.Text.Json;

namespace MsfsCompanion.Bridge.Integrations;

public sealed record VatsimPilot(string Callsign, double Latitude, double Longitude,
    int AltitudeFeet, int GroundSpeedKt, int Heading, string? Aircraft);
public sealed record VatsimController(string Callsign, string Frequency, int Facility);

public sealed class VatsimService
{
    private static readonly HttpClient Client = CreateClient();
    private readonly SemaphoreSlim _gate = new(1, 1);
    private DateTimeOffset _fetchedAt = DateTimeOffset.MinValue;
    private VatsimPilot[] _pilots = [];
    private VatsimController[] _controllers = [];
    private string? _lastError;

    private static HttpClient CreateClient()
    {
        var c = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri("https://data.vatsim.net/v3/"),
            Timeout = TimeSpan.FromSeconds(12)
        };
        c.DefaultRequestHeaders.UserAgent.Add(
            new ProductInfoHeaderValue("MSFS-Companion", "0.2"));
        return c;
    }

    public object CacheHealth() => new {
        loaded = _fetchedAt != DateTimeOffset.MinValue,
        updatedAt = _fetchedAt == DateTimeOffset.MinValue ? (DateTimeOffset?)null : _fetchedAt,
        stale = _fetchedAt != DateTimeOffset.MinValue &&
            DateTimeOffset.UtcNow - _fetchedAt > TimeSpan.FromMinutes(3),
        lastError = _lastError
    };

    public async Task<object> NearbyAsync(double lat, double lon, double radiusKm,
        string? airport, CancellationToken ct)
    {
        await EnsureLoadedAsync(ct);
        VatsimPilot[] pilots;
        VatsimController[] controllers;
        DateTimeOffset updated;
        string? error;
        await _gate.WaitAsync(ct);
        try
        {
            pilots = _pilots; controllers = _controllers;
            updated = _fetchedAt; error = _lastError;
        }
        finally { _gate.Release(); }

        var filtered = pilots
            .Select(p => (Pilot: p, Distance: DistanceKm(lat, lon, p.Latitude, p.Longitude)))
            .Where(x => x.Distance <= radiusKm)
            .OrderBy(x => x.Distance).Take(80)
            .Select(x => x.Pilot).ToArray();
        var atc = string.IsNullOrWhiteSpace(airport) ? Array.Empty<VatsimController>() :
            controllers.Where(c => c.Callsign.StartsWith(airport + "_",
                StringComparison.OrdinalIgnoreCase))
                .Take(35).ToArray();
        return new
        {
            available = updated != DateTimeOffset.MinValue,
            source = "VATSIM",
            updatedAt = updated == DateTimeOffset.MinValue ? (DateTimeOffset?)null : updated,
            stale = updated != DateTimeOffset.MinValue &&
                DateTimeOffset.UtcNow - updated > TimeSpan.FromMinutes(3),
            error, pilots = filtered, controllers = atc
        };
    }

    private async Task EnsureLoadedAsync(CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow - _fetchedAt < TimeSpan.FromSeconds(30)) return;
        await _gate.WaitAsync(ct);
        try
        {
            if (DateTimeOffset.UtcNow - _fetchedAt < TimeSpan.FromSeconds(30)) return;
            // Backoff po výpadku, aniž by se dotazovalo při každém požadavku z iPadu.
            if (_lastError is not null &&
                DateTimeOffset.UtcNow - _lastFailure < TimeSpan.FromSeconds(45)) return;
            try
            {
                using var response = await Client.GetAsync("vatsim-data.json",
                    HttpCompletionOption.ResponseHeadersRead, ct);
                response.EnsureSuccessStatusCode();
                if (response.Content.Headers.ContentLength is > 12_000_000)
                    throw new InvalidDataException("VATSIM response too large");
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var limited = new MemoryStream();
                var buffer = new byte[65536];
                int count;
                while ((count = await stream.ReadAsync(buffer, ct)) != 0)
                {
                    if (limited.Length + count > 12_000_000)
                        throw new InvalidDataException("VATSIM response too large");
                    limited.Write(buffer, 0, count);
                }
                limited.Position = 0;
                using var document = await JsonDocument.ParseAsync(limited,
                    new JsonDocumentOptions { MaxDepth = 25 }, ct);
                var root = document.RootElement;
                static string Txt(JsonElement e, string name, int max = 32) =>
                    e.TryGetProperty(name, out var value) &&
                    value.ValueKind == JsonValueKind.String
                    ? (value.GetString() ?? "")[..Math.Min(value.GetString()?.Length ?? 0, max)] : "";
                static int Int(JsonElement e, string name) =>
                    e.TryGetProperty(name, out var value) && value.TryGetInt32(out var v) ? v : 0;
                var pilots = new List<VatsimPilot>(2000);
                if (root.TryGetProperty("pilots", out var pilotList) &&
                    pilotList.ValueKind == JsonValueKind.Array)
                {
                    foreach (var p in pilotList.EnumerateArray().Take(7000))
                    {
                        if (!p.TryGetProperty("latitude", out var la) ||
                            !p.TryGetProperty("longitude", out var lo) ||
                            !la.TryGetDouble(out var lat) || !lo.TryGetDouble(out var lon) ||
                            !double.IsFinite(lat) || !double.IsFinite(lon) ||
                            Math.Abs(lat) > 85.05 || Math.Abs(lon) > 180) continue;
                        var callsign = Txt(p, "callsign", 16);
                        if (callsign.Length == 0) continue;
                        string? aircraft = null;
                        if (p.TryGetProperty("flight_plan", out var plan) &&
                            plan.ValueKind == JsonValueKind.Object)
                            aircraft = Txt(plan, "aircraft_short", 16);
                        pilots.Add(new VatsimPilot(callsign, lat, lon,
                            Int(p, "altitude"), Int(p, "groundspeed"), Int(p, "heading"), aircraft));
                    }
                }
                var controllers = new List<VatsimController>(500);
                if (root.TryGetProperty("controllers", out var controlList) &&
                    controlList.ValueKind == JsonValueKind.Array)
                {
                    foreach (var p in controlList.EnumerateArray().Take(3000))
                    {
                        var name = Txt(p, "callsign", 24);
                        if (name.Length == 0) continue;
                        controllers.Add(new VatsimController(name,
                            Txt(p, "frequency", 12), Int(p, "facility")));
                    }
                }
                _pilots = pilots.ToArray();
                _controllers = controllers.ToArray();
                _fetchedAt = DateTimeOffset.UtcNow;
                _lastError = null;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
                JsonException or InvalidDataException)
            {
                _lastError = "VATSIM datový feed není dostupný.";
                _lastFailure = DateTimeOffset.UtcNow;
            }
        }
        finally { _gate.Release(); }
    }

    private DateTimeOffset _lastFailure;
    private static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double toRadians = Math.PI / 180;
        var x = Math.Sin((lat2 - lat1) * toRadians / 2);
        var delta = ((lon2 - lon1 + 540) % 360) - 180;
        var y = Math.Sin(delta * toRadians / 2);
        var a = x * x + Math.Cos(lat1 * toRadians) * Math.Cos(lat2 * toRadians) * y * y;
        return 12742 * Math.Asin(Math.Sqrt(Math.Clamp(a, 0, 1)));
    }

    public static void MapEndpoints(WebApplication app)
    {
        app.MapGet("/api/vatsim/nearby", async (double lat, double lon, double? radiusKm,
            string? airport, VatsimService service, CancellationToken ct) =>
        {
            var radius = radiusKm ?? 150;
            if (!double.IsFinite(lat) || !double.IsFinite(lon) ||
                Math.Abs(lat) > 85.05 || Math.Abs(lon) > 180 ||
                !double.IsFinite(radius) || radius < 10 || radius > 500 ||
                airport is { Length: > 0 } &&
                    (airport.Length != 4 || !airport.All(char.IsAsciiLetter)))
                return Results.BadRequest(new { error = "Neplatné souřadnice, radius nebo ICAO." });
            return Results.Ok(await service.NearbyAsync(lat, lon, radius,
                airport?.ToUpperInvariant(), ct));
        });
    }
}
