using System.Text.Json;
using System.Text.RegularExpressions;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Recorder;

public sealed record FlightSummary(
    string Id,
    string Mode,
    string Aircraft,
    DateTimeOffset StartedAtUtc,
    DateTimeOffset? EndedAtUtc,
    DateTimeOffset LastAtUtc,
    int Samples,
    double DistanceMeters,
    double MaxAirspeedKnots,
    double MaxAltitudeFeet,
    bool Active);

public sealed record FlightDetail(FlightSummary Summary, IReadOnlyList<TelemetrySnapshot> Samples);

/// <summary>
/// Read-only flight recorder: max. 1 sample/s, six hours per segment,
/// 30 recent flights, 100 MiB on disk. Never calls SimConnect write API.
/// </summary>
public sealed class FlightRecorder(
    TelemetryStore store,
    TelemetryHealth health,
    ITelemetrySource source,
    ILogger<FlightRecorder> logger) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex ValidId = new(
        @"\A\d{8}T\d{6}-[0-9a-f]{12}\z",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private const int MaxFlights = 30;
    private const long MaxTotalBytes = 100L * 1024 * 1024;

    private readonly object _gate = new();
    private readonly string _directory = Environment.GetEnvironmentVariable("MSFS_COMPANION_RECORDINGS_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "MSFS Companion", "flights");

    private FlightSummary? _active;
    private TelemetrySnapshot? _previous;
    private DateTimeOffset? _lastValidTick;
    private DateTimeOffset? _lastMetaSave;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            Directory.CreateDirectory(_directory);
            RecoverOrphanedSessions();
            Prune();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogError(ex, "Záznam letu nelze uložit do {Directory}", _directory);
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    Capture(DateTimeOffset.UtcNow);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    logger.LogWarning(ex, "Ukládání letu selhalo; zachovávám běh telemetrie.");
                    lock (_gate) { CloseFlight(); }
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Ukončení bridge ani restart updateru nesmí ukončit MSFS.
        }
        finally
        {
            lock (_gate) { CloseFlight(); }
        }
    }

    private void Capture(DateTimeOffset now)
    {
        var state = health.Snapshot(source.Mode);
        var sample = store.Current;
        var fresh = state.Connected
            && state.LastTelemetryUtc is not null
            && (now - sample.TimestampUtc).TotalSeconds is >= -1 and < 3
            && !sample.Aircraft.StartsWith("MSFS není", StringComparison.Ordinal)
            && !sample.Aircraft.StartsWith("Čekám na", StringComparison.Ordinal);

        lock (_gate)
        {
            if (!fresh)
            {
                if (_active is not null && _lastValidTick is { } last
                    && now - last > TimeSpan.FromSeconds(10))
                    CloseFlight();
                return;
            }

            _lastValidTick = now;
            if (_previous is not null && sample.TimestampUtc <= _previous.TimestampUtc)
                return;

            if (_active is not null
                && (_active.Aircraft != sample.Aircraft
                    || _active.Mode != source.Mode
                    || now - _active.StartedAtUtc > TimeSpan.FromHours(6)))
                CloseFlight();

            if (_active is null)
                BeginFlight(sample, source.Mode);

            var distance = _previous is null ? 0 : DistanceMeters(_previous, sample);
            // Rozlišit běžný pohyb od teleportu ve světové mapě.
            if (distance > 100_000) distance = 0;

            var summary = _active!;
            var updated = summary with
            {
                LastAtUtc = sample.TimestampUtc,
                Samples = summary.Samples + 1,
                DistanceMeters = summary.DistanceMeters + distance,
                MaxAirspeedKnots = Math.Max(summary.MaxAirspeedKnots, sample.AirspeedKnots),
                MaxAltitudeFeet = Math.Max(summary.MaxAltitudeFeet, sample.AltitudeFeet),
            };

            File.AppendAllText(DataPath(summary.Id),
                JsonSerializer.Serialize(sample, JsonOptions) + Environment.NewLine);
            _active = updated;
            _previous = sample;

            if (_lastMetaSave is null || now - _lastMetaSave >= TimeSpan.FromSeconds(10))
            {
                SaveMetadata(updated);
                _lastMetaSave = now;
            }
        }
    }

    private void BeginFlight(TelemetrySnapshot sample, string mode)
    {
        var id = sample.TimestampUtc.ToString("yyyyMMdd'T'HHmmss") + "-"
            + Guid.NewGuid().ToString("N")[..12];
        _active = new FlightSummary(id, mode, sample.Aircraft,
            sample.TimestampUtc, null, sample.TimestampUtc, 0, 0, 0,
            sample.AltitudeFeet, true);
        _previous = null;
        _lastMetaSave = null;
        SaveMetadata(_active);
        logger.LogInformation("Nový záznam letu {Id}: {Aircraft}", id, sample.Aircraft);
    }

    private void CloseFlight()
    {
        if (_active is null) return;
        var completed = _active with { Active = false, EndedAtUtc = _active.LastAtUtc };
        try { SaveMetadata(completed); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Nepodařilo se uzavřít záznam letu {Id}", completed.Id);
        }
        _active = null;
        _previous = null;
        _lastValidTick = null;
        _lastMetaSave = null;
        Prune();
    }

    private void SaveMetadata(FlightSummary summary)
    {
        var path = MetaPath(summary.Id);
        var tmp = path + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(summary, JsonOptions));
        File.Move(tmp, path, overwrite: true);
    }

    private string DataPath(string id) => Path.Combine(_directory, id + ".jsonl");
    private string MetaPath(string id) => Path.Combine(_directory, id + ".meta.json");

    private void RecoverOrphanedSessions()
    {
        // Po nečekaném ukončení nejsou relace nadále aktivní.
        foreach (var file in Directory.EnumerateFiles(_directory, "*.meta.json"))
        {
            try
            {
                var item = JsonSerializer.Deserialize<FlightSummary>(
                    File.ReadAllText(file), JsonOptions);
                if (item is { Active: true } && ValidId.IsMatch(item.Id))
                    SaveMetadata(item with { Active = false, EndedAtUtc = item.LastAtUtc });
            }
            catch (Exception ex) when (ex is IOException or JsonException)
            {
                logger.LogWarning("Poškozená metadata letu {File}: {Error}", file, ex.Message);
            }
        }
    }

    private void Prune()
    {
        try
        {
            var files = Directory.EnumerateFiles(_directory, "*.meta.json")
                .OrderByDescending(x => x, StringComparer.Ordinal)
                .ToArray();
            long bytes = 0;
            for (var i = 0; i < files.Length; i++)
            {
                var id = Path.GetFileName(files[i])[..^".meta.json".Length];
                if (!ValidId.IsMatch(id)) continue;
                var dataPath = DataPath(id);
                var size = new FileInfo(files[i]).Length
                    + (File.Exists(dataPath) ? new FileInfo(dataPath).Length : 0);
                bytes += size;
                if (i < MaxFlights && bytes <= MaxTotalBytes) continue;
                if (_active?.Id == id) continue;
                File.Delete(files[i]);
                if (File.Exists(dataPath)) File.Delete(dataPath);
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning(ex, "Nepodařilo se promazat starou historii letů.");
        }
    }

    private static double DistanceMeters(TelemetrySnapshot a, TelemetrySnapshot b)
    {
        var dLat = (b.Latitude - a.Latitude) * Math.PI / 180;
        var dLon = (b.Longitude - a.Longitude) * Math.PI / 180;
        var la1 = a.Latitude * Math.PI / 180;
        var la2 = b.Latitude * Math.PI / 180;
        var h = Math.Pow(Math.Sin(dLat / 2), 2)
            + Math.Cos(la1) * Math.Cos(la2) * Math.Pow(Math.Sin(dLon / 2), 2);
        return 12_742_000 * Math.Asin(Math.Min(1, Math.Sqrt(h)));
    }

    public IReadOnlyList<FlightSummary> List()
    {
        lock (_gate)
        {
            try
            {
                if (!Directory.Exists(_directory)) return [];
                var flights = new List<FlightSummary>();
                foreach (var file in Directory.EnumerateFiles(_directory, "*.meta.json")
                             .OrderByDescending(x => x, StringComparer.Ordinal)
                             .Take(MaxFlights))
                {
                    try
                    {
                        var flight = JsonSerializer.Deserialize<FlightSummary>(
                            File.ReadAllText(file), JsonOptions);
                        if (flight is not null && ValidId.IsMatch(flight.Id)
                            && File.Exists(DataPath(flight.Id)))
                            flights.Add(_active?.Id == flight.Id ? _active : flight);
                    }
                    catch (JsonException) { /* Přeskočit poškozenou položku. */ }
                }
                return flights;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex, "Historii letů nelze načíst.");
                return [];
            }
        }
    }

    public FlightDetail? Read(string id)
    {
        if (!ValidId.IsMatch(id)) return null;
        lock (_gate)
        {
            var summary = List().FirstOrDefault(x => x.Id == id);
            if (summary is null) return null;
            try
            {
                // Podrobná vizualizace je omezená na 4000 vzorků.
                var stride = Math.Max(1, (int)Math.Ceiling(summary.Samples / 4000d));
                var points = new List<TelemetrySnapshot>();
                var row = 0;
                foreach (var line in File.ReadLines(DataPath(id)))
                {
                    if ((row++ % stride) != 0) continue;
                    if (points.Count >= 4000) break;
                    try
                    {
                        var point = JsonSerializer.Deserialize<TelemetrySnapshot>(line, JsonOptions);
                        if (point is not null) points.Add(point);
                    }
                    catch (JsonException) { /* Nedokončený poslední řádek. */ }
                }
                return new FlightDetail(summary, points);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex, "Nepodařilo se načíst průběh letu {Id}", id);
                return null;
            }
        }
    }
}
