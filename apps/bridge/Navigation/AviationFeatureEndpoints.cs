using System.Globalization;
using System.Text.Json;

namespace MsfsCompanion.Bridge.Navigation;

public sealed record AviationFeature(string Type, string Ident, string Name, double Latitude, double Longitude);

/// <summary>Volitelná pouze-čtecí integrace s lokálním Little Navmap Web API.</summary>
public static class AviationFeatureEndpoints
{
    private static readonly HttpClient Client = new()
    {
        BaseAddress = new Uri("http://127.0.0.1:8965/"),
        Timeout = TimeSpan.FromSeconds(3)
    };
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static string _key = "";
    private static DateTimeOffset _validUntil;
    private static AviationFeature[] _cached = [];

    public static void MapAviationFeatures(this WebApplication app)
    {
        app.MapGet("/api/map/aviation", async (double lat, double lon, CancellationToken ct) =>
        {
            if (!double.IsFinite(lat) || !double.IsFinite(lon) ||
                Math.Abs(lat) > 84 || Math.Abs(lon) > 178)
                return Results.BadRequest(new { error = "Neplatná zeměpisná poloha." });

            // Žádné DNS ani uživatelské URL: pouze Little Navmap na stejném Windows PC.
            var centerLat = Math.Round(lat * 2) / 2;
            var centerLon = Math.Round(lon * 2) / 2;
            var key = $"{centerLat:0.0}:{centerLon:0.0}";
            await Gate.WaitAsync(ct);
            try
            {
                if (key == _key && DateTimeOffset.UtcNow < _validUntil)
                    return Results.Ok(new { available = true, source = "Little Navmap", features = _cached });
                var en = CultureInfo.InvariantCulture;
                var url = $"api/map/features?toplat={(centerLat + .75).ToString(en)}" +
                    $"&bottomlat={(centerLat - .75).ToString(en)}" +
                    $"&leftlon={(centerLon - .75).ToString(en)}" +
                    $"&rightlon={(centerLon + .75).ToString(en)}";
                using var response = await Client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
                if (!response.IsSuccessStatusCode ||
                    response.Content.Headers.ContentLength is > 2_000_000)
                    return Results.Ok(new { available = false, source = "Little Navmap", features = Array.Empty<AviationFeature>() });
                await using var stream = await response.Content.ReadAsStreamAsync(ct);
                using var document = await JsonDocument.ParseAsync(stream, new JsonDocumentOptions { MaxDepth = 24 }, ct);
                var features = new List<AviationFeature>(300);
                foreach (var (field, kind) in new[] { ("airports", "airport"), ("vors", "vor"), ("ndbs", "ndb") })
                {
                    if (!document.RootElement.TryGetProperty(field, out var collection) ||
                        !collection.TryGetProperty("result", out var result) || result.ValueKind != JsonValueKind.Array)
                        continue;
                    foreach (var entry in result.EnumerateArray())
                    {
                        if (features.Count >= 300) break;
                        if (!entry.TryGetProperty("position", out var position) ||
                            !position.TryGetProperty("lat", out var latitude) ||
                            !position.TryGetProperty("lon", out var longitude) ||
                            !latitude.TryGetDouble(out var la) || !longitude.TryGetDouble(out var lo) ||
                            !double.IsFinite(la) || !double.IsFinite(lo) ||
                            Math.Abs(la) > 85.05 || Math.Abs(lo) > 180) continue;
                        var ident = entry.TryGetProperty("ident", out var id) ? id.GetString() ?? "" : "";
                        var name = entry.TryGetProperty("name", out var label) ? label.GetString() ?? "" : "";
                        features.Add(new AviationFeature(kind, ident[..Math.Min(ident.Length, 24)],
                            name[..Math.Min(name.Length, 80)], la, lo));
                    }
                }
                _key = key;
                _cached = features.ToArray();
                _validUntil = DateTimeOffset.UtcNow.AddSeconds(30);
                return Results.Ok(new { available = true, source = "Little Navmap", features = _cached });
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException or IOException)
            {
                return Results.Ok(new { available = false, source = "Little Navmap", features = Array.Empty<AviationFeature>() });
            }
            finally { Gate.Release(); }
        });
    }
}
