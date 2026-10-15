using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Net;
using System.Text;
using System.Text.Json;

namespace MsfsCompanion.Bridge.Navigation;

/// <summary>
/// Vlastní bezinstalační zdroj mapových dat: jeden lazy refresh globálních
/// public-domain CSV OurAirports za 24 h, atomická cache na disku a stale fallback.
/// Žádné URL, souborové cesty ani API klíče nepřicházejí z prohlížeče.
/// </summary>
public sealed class AviationCatalog(ILogger<AviationCatalog> logger)
{
    public const string Source = "OurAirports";
    private const string DataBase = "https://davidmegginson.github.io/ourairports-data/";
    private static readonly HttpClient Client = new()
    {
        Timeout = TimeSpan.FromSeconds(90)
    };
    private readonly object _gate = new();
    private AviationCatalogSnapshot? _snapshot;
    private Task? _refreshTask;
    private DateTimeOffset _lastAttempt;
    private string? _error;

    private static string CachePath =>
        Path.Combine(
            Environment.GetEnvironmentVariable("MSFS_COMPANION_AVIATION_CACHE_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "MSFS Companion", "aviation"),
            "ourairports-v1.json.gz");

    public void RequestRefresh()
    {
        lock (_gate)
        {
            if (_refreshTask is { IsCompleted: false }) return;
            var now = DateTimeOffset.UtcNow;
            if (_snapshot is { } current && now - current.UpdatedAt < TimeSpan.FromHours(24))
                return;
            // V případě výpadku připojení nezahlcovat zdroj ani API klienta.
            if (now - _lastAttempt < TimeSpan.FromMinutes(15)) return;
            _lastAttempt = now;
            _refreshTask = Task.Run(RefreshAsync);
        }
    }

    private async Task RefreshAsync()
    {
        try
        {
            if (Volatile.Read(ref _snapshot) is null)
            {
                var cached = await ReadCacheAsync();
                if (cached is not null && cached.Airports.Length > 1_000)
                {
                    Interlocked.Exchange(ref _snapshot, cached);
                    logger.LogInformation("OurAirports načteno z diskové cache ({Count} letišť).", cached.Airports.Length);
                }
            }

            var present = Volatile.Read(ref _snapshot);
            if (present is not null && DateTimeOffset.UtcNow - present.UpdatedAt < TimeSpan.FromHours(24))
                return;

            // Velké soubory pouze na backendu, nikdy na iPadu; horní limity
            // chrání paměť i proti změně upstream obsahu.
            var airports = OurAirportsCsv.Airports(await DownloadAsync("airports.csv", 28_000_000));
            var runways = OurAirportsCsv.Runways(await DownloadAsync("runways.csv", 24_000_000));
            var navaids = OurAirportsCsv.Navaids(await DownloadAsync("navaids.csv", 10_000_000));
            var frequencies = OurAirportsCsv.Frequencies(
                await DownloadAsync("airport-frequencies.csv", 8_000_000));

            if (airports.Length < 1_000 || runways.Length < 1_000 ||
                navaids.Length < 100 || frequencies.Length < 100)
                throw new InvalidDataException("OurAirports dataset je neúplný.");

            var next = new AviationCatalogSnapshot(DateTimeOffset.UtcNow,
                airports, runways, navaids, frequencies);
            // Atomické přepnutí až po úspěšné validaci všech čtyř datasetů.
            Interlocked.Exchange(ref _snapshot, next);
            Volatile.Write(ref _error, null);
            logger.LogInformation("OurAirports aktualizováno: {Airports} letišť, {Runways} drah, " +
                "{Navaids} navigačních bodů, {Frequencies} frekvencí.",
                airports.Length, runways.Length, navaids.Length, frequencies.Length);
            try { await SaveCacheAsync(next); }
            catch (Exception ex) { logger.LogWarning(ex, "OurAirports disk cache se nepodařilo uložit."); }
        }
        catch (Exception ex)
        {
            Volatile.Write(ref _error, "Online aktualizace není dostupná.");
            logger.LogWarning(ex, "OurAirports načtení selhalo; zachována poslední úspěšná cache.");
        }
    }

    private static async Task<string> DownloadAsync(string file, long maximumBytes)
    {
        // Jen pevný HTTPS zdroj, bez uživatelských URI či přesměrování na LAN.
        using var response = await Client.GetAsync(DataBase + file,
            HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentLength is { } size && size > maximumBytes)
            throw new InvalidDataException("OurAirports CSV je příliš velké.");
        await using var input = await response.Content.ReadAsStreamAsync();
        await using var output = new MemoryStream();
        var buffer = new byte[65536];
        int read;
        while ((read = await input.ReadAsync(buffer)) != 0)
        {
            if (output.Length + read > maximumBytes)
                throw new InvalidDataException("OurAirports CSV překročilo datový limit.");
            await output.WriteAsync(buffer.AsMemory(0, read));
        }
        return Encoding.UTF8.GetString(output.ToArray());
    }

    private static async Task<AviationCatalogSnapshot?> ReadCacheAsync()
    {
        var path = CachePath;
        if (!File.Exists(path) || new FileInfo(path).Length > 60_000_000)
            return null;
        try
        {
            await using var stream = File.OpenRead(path);
            await using var zip = new GZipStream(stream, CompressionMode.Decompress);
            return await JsonSerializer.DeserializeAsync<AviationCatalogSnapshot>(zip,
                new JsonSerializerOptions { MaxDepth = 16 });
        }
        catch (Exception) { return null; }
    }

    private static async Task SaveCacheAsync(AviationCatalogSnapshot snapshot)
    {
        var path = CachePath;
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            await using (var stream = new FileStream(temp, FileMode.CreateNew, FileAccess.Write))
            {
                await using (var zip = new GZipStream(stream, CompressionLevel.Fastest))
                    await JsonSerializer.SerializeAsync(zip, snapshot);
            }
            File.Move(temp, path, true);
        }
        finally
        {
            if (File.Exists(temp)) File.Delete(temp);
        }
    }

    public object CacheHealth()
    {
        var snapshot = Volatile.Read(ref _snapshot);
        return new {
            available = snapshot is not null,
            updatedAt = snapshot?.UpdatedAt,
            stale = snapshot is not null &&
                DateTimeOffset.UtcNow - snapshot.UpdatedAt > TimeSpan.FromHours(48),
            refreshRunning = _refreshTask is { IsCompleted: false },
            lastError = _error,
            airports = snapshot?.Airports.Length ?? 0
        };
    }

    public object Nearby(double lat, double lon, double radiusKm)
    {
        RequestRefresh();
        var data = Volatile.Read(ref _snapshot);
        var loading = _refreshTask is { IsCompleted: false };
        if (data is null)
            return new { available = false, loading, stale = false, source = Source,
                updatedAt = (DateTimeOffset?)null, error = _error, features = Array.Empty<AviationFeature>() };
        return new { available = true, loading,
            stale = DateTimeOffset.UtcNow - data.UpdatedAt > TimeSpan.FromHours(48),
            source = Source, updatedAt = (DateTimeOffset?)data.UpdatedAt,
            error = _error, features = FindNearby(data, lat, lon, radiusKm) };
    }

    /// <summary>Lokální textový index nad již staženými daty, žádný další API fetch.</summary>
    public object Search(string? query)
    {
        RequestRefresh();
        var catalog = Volatile.Read(ref _snapshot);
        if (catalog is null)
            return new { available = false, source = Source, airports = Array.Empty<AirportData>() };
        var term = (query ?? "").Trim();
        if (term.Length is < 2 or > 70)
            return new { available = true, source = Source, airports = Array.Empty<AirportData>() };
        var exact = catalog.Airports
            .Where(x => x.Ident.Equals(term, StringComparison.OrdinalIgnoreCase));
        var prefix = catalog.Airports
            .Where(x => x.Ident.StartsWith(term, StringComparison.OrdinalIgnoreCase) ||
                x.Name.StartsWith(term, StringComparison.OrdinalIgnoreCase));
        var partial = catalog.Airports
            .Where(x => x.Name.Contains(term, StringComparison.OrdinalIgnoreCase));
        var matches = exact.Concat(prefix).Concat(partial)
            .DistinctBy(x => x.Ident, StringComparer.OrdinalIgnoreCase)
            .Take(25).ToArray();
        return new { available = true, source = Source, airports = matches };
    }

    public object? Airport(string ident)
    {
        RequestRefresh();
        var data = Volatile.Read(ref _snapshot);
        if (data is null) return null;
        var airport = data.Airports.FirstOrDefault(a =>
            a.Ident.Equals(ident, StringComparison.OrdinalIgnoreCase));
        if (airport is null) return null;
        return new
        {
            airport,
            runways = data.Runways.Where(r => r.AirportIdent.Equals(airport.Ident,
                StringComparison.OrdinalIgnoreCase)).Take(20).ToArray(),
            frequencies = data.Frequencies.Where(f => f.AirportIdent.Equals(airport.Ident,
                StringComparison.OrdinalIgnoreCase)).Take(35).ToArray(),
            source = Source, updatedAt = data.UpdatedAt
        };
    }

    // Immutable, one-degree geographic buckets are shared across requests for
    // a specific snapshot. When a new global dataset replaces the old one,
    // ConditionalWeakTable does not keep the retired snapshot alive.
    private static readonly ConditionalWeakTable<AviationCatalogSnapshot, SpatialIndex> SpatialIndexes = new();

    private sealed class SpatialIndex(AviationCatalogSnapshot snapshot)
    {
        public readonly SpatialBuckets<AirportData> Airports =
            new(snapshot.Airports, x => x.Latitude, x => x.Longitude);
        public readonly SpatialBuckets<NavaidData> Navaids =
            new(snapshot.Navaids, x => x.Latitude, x => x.Longitude);
        public readonly SpatialBuckets<RunwayData> Runways =
            new(snapshot.Runways, x => x.Latitude, x => x.Longitude);
    }

    private sealed class SpatialBuckets<T>
    {
        public readonly record struct Entry(T Item, int OriginalIndex);
        private readonly Dictionary<int, List<Entry>> _cells = new();

        private static int WrapLongitudeCell(int cell) =>
            ((cell + 180) % 360 + 360) % 360 - 180;
        private static int Key(int latitudeCell, int longitudeCell) =>
            (latitudeCell + 90) * 360 + (WrapLongitudeCell(longitudeCell) + 180);

        public SpatialBuckets(T[] source, Func<T, double> latitude, Func<T, double> longitude)
        {
            for (var i = 0; i < source.Length; i++)
            {
                var item = source[i];
                var cell = Key((int)Math.Floor(latitude(item)),
                    (int)Math.Floor(longitude(item)));
                if (!_cells.TryGetValue(cell, out var bucket))
                    _cells[cell] = bucket = [];
                bucket.Add(new Entry(item, i));
            }
        }

        public IEnumerable<Entry> Candidates(double latitude, double longitude, double radiusKm)
        {
            // Conservative spherical bounding box: no valid point inside the
            // requested radius may be discarded, including near the dateline.
            // The precise great-circle check is still performed by FindNearby.
            var latDelta = Math.Max(0, radiusKm) / 110.0 + 0.01;
            var farLatitude = Math.Min(89.999, Math.Abs(latitude) + latDelta);
            var lonDelta = Math.Min(180.0,
                latDelta / Math.Max(0.00001, Math.Cos(farLatitude * Math.PI / 180)) + 0.01);
            var south = (int)Math.Floor(Math.Max(-85.05, latitude - latDelta));
            var north = (int)Math.Floor(Math.Min(85.05, latitude + latDelta));
            var west = lonDelta >= 180 ? -180 : (int)Math.Floor(longitude - lonDelta);
            var east = lonDelta >= 180 ? 179 : (int)Math.Floor(longitude + lonDelta);
            for (var lat = south; lat <= north; lat++)
            for (var lon = west; lon <= east; lon++)
            {
                if (_cells.TryGetValue(Key(lat, lon), out var bucket))
                    foreach (var entry in bucket)
                        yield return entry;
            }
        }
    }

    public static AviationFeature[] FindNearby(AviationCatalogSnapshot data,
        double latitude, double longitude, double radiusKm)
    {
        var index = SpatialIndexes.GetValue(data, snapshot => new SpatialIndex(snapshot));
        var airports = index.Airports.Candidates(latitude, longitude, radiusKm)
            .Select(a => (item: a.Item, original: a.OriginalIndex,
                distance: DistanceKm(latitude, longitude, a.Item.Latitude, a.Item.Longitude)))
            .Where(x => x.distance <= radiusKm)
            .OrderBy(x => x.distance).ThenBy(x => x.original).Take(70)
            .Select(x => new AviationFeature("airport", x.item.Ident, x.item.Name,
                x.item.Latitude, x.item.Longitude))
            .ToArray();

        var navaids = index.Navaids.Candidates(latitude, longitude, radiusKm)
            .Select(n => (item: n.Item, original: n.OriginalIndex,
                distance: DistanceKm(latitude, longitude, n.Item.Latitude, n.Item.Longitude)))
            .Where(x => x.distance <= radiusKm)
            .OrderBy(x => x.distance).ThenBy(x => x.original).Take(90)
            .Select(x => new AviationFeature(x.item.Type, x.item.Ident, x.item.Name,
                x.item.Latitude, x.item.Longitude, FrequencyKhz: x.item.FrequencyKhz))
            .ToArray();

        var runways = index.Runways.Candidates(latitude, longitude, radiusKm)
            .Select(r => (item: r.Item, original: r.OriginalIndex,
                distance: DistanceKm(latitude, longitude, r.Item.Latitude, r.Item.Longitude)))
            .Where(x => x.distance <= radiusKm)
            .OrderBy(x => x.distance).ThenBy(x => x.original).Take(80)
            .Select(x => new AviationFeature("runway",
                x.item.LowIdent + "/" + x.item.HighIdent, "Dráha " +
                x.item.LowIdent + "/" + x.item.HighIdent,
                x.item.Latitude, x.item.Longitude,
                x.item.EndLatitude, x.item.EndLongitude,
                x.item.AirportIdent, x.item.LengthFeet, x.item.Surface))
            .ToArray();

        return [..airports, ..navaids, ..runways];
    }

    private static double DistanceKm(double lat1, double lon1, double lat2, double lon2)
    {
        var radians = Math.PI / 180;
        var a = Math.Sin((lat2 - lat1) * radians / 2);
        var deltaLon = ((lon2 - lon1 + 540) % 360) - 180;
        var b = Math.Sin(deltaLon * radians / 2);
        var h = a * a + Math.Cos(lat1 * radians) * Math.Cos(lat2 * radians) * b * b;
        return 12742 * Math.Asin(Math.Sqrt(Math.Clamp(h, 0, 1)));
    }
}
