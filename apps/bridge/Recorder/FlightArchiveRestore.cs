using System.Text.Json;

namespace MsfsCompanion.Bridge.Recorder;

// This schema matches the already-exported Kokpit C49 JSON. No extra fields
// may be interpreted as requests to overwrite or delete existing flights.
public sealed record FlightBackupArchive(
    string Schema, DateTimeOffset ExportedAtUtc, IReadOnlyList<FlightDetail> Flights);
public sealed record FlightRestoreResult(bool Success, string Message, int Imported);

public sealed partial class FlightRecorder
{
    private static bool ValidSample(FlightRecordedSample? sample) =>
        sample is not null
        && sample.TimestampUtc.Year is >= 2000 and <= 2100
        && !string.IsNullOrWhiteSpace(sample.Aircraft) && sample.Aircraft.Length <= 200
        && double.IsFinite(sample.Latitude) && Math.Abs(sample.Latitude) <= 90
        && double.IsFinite(sample.Longitude) && Math.Abs(sample.Longitude) <= 180
        && double.IsFinite(sample.AirspeedKnots) && sample.AirspeedKnots is >= 0 and <= 1500
        && double.IsFinite(sample.AltitudeFeet) && sample.AltitudeFeet is >= -3000 and <= 100000
        && double.IsFinite(sample.VerticalSpeedFeetPerMinute)
        && Math.Abs(sample.VerticalSpeedFeetPerMinute) <= 30000
        && double.IsFinite(sample.HeadingDegrees)
        && double.IsFinite(sample.PitchDegrees) && double.IsFinite(sample.BankDegrees);

    public FlightRestoreResult RestoreArchive(FlightBackupArchive? archive)
    {
        if (archive is null || archive.Schema != "kokpit-flight-backup-v1"
            || archive.ExportedAtUtc.Year is < 2000 or > 2100
            || archive.Flights is null || archive.Flights.Count is < 1 or > 30)
            return new(false, "Neplatný formát nebo počet letů v záloze.", 0);

        // Validate all data BEFORE writing anything, including a duplicate
        // source flight ID or active / incomplete recording.
        var sourceIds = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in archive.Flights)
        {
            var summary = item?.Summary;
            var samples = item?.Samples;
            if (summary is null || samples is null ||
                !ValidId.IsMatch(summary.Id ?? "") ||
                !sourceIds.Add(summary.Id) ||
                string.IsNullOrWhiteSpace(summary.Aircraft) || summary.Aircraft.Length > 200 ||
                summary.Mode is not ("simconnect" or "mock") ||
                summary.Active || summary.EndedAtUtc is null ||
                summary.StartedAtUtc.Year is < 2000 or > 2100 ||
                summary.LastAtUtc < summary.StartedAtUtc ||
                summary.LastAtUtc > summary.StartedAtUtc.AddHours(7) ||
                samples.Count is < 1 or > 4000)
                return new(false, "Záloha obsahuje neúplný, aktivní či neplatný let.", 0);

            DateTimeOffset? previous = null;
            foreach (var sample in samples)
            {
                if (!ValidSample(sample) ||
                    sample.Aircraft != summary.Aircraft ||
                    sample.TimestampUtc < summary.StartedAtUtc.AddMinutes(-1) ||
                    sample.TimestampUtc > summary.LastAtUtc.AddMinutes(1) ||
                    previous is not null && sample.TimestampUtc <= previous.Value)
                    return new(false, "Vzorky letu nejsou konzistentní nebo časově seřazené.", 0);
                previous = sample.TimestampUtc;
            }
        }
        lock (_gate)
        {
            if (_active is not null)
                return new(false, "Probíhá zaznamenávání letu. Obnovu spusťte po jeho ukončení.", 0);
            try
            {
                Directory.CreateDirectory(_directory);
                var existing = Directory.EnumerateFiles(_directory, "*.meta.json").ToArray();
                if (existing.Length + archive.Flights.Count > MaxFlights)
                    return new(false, "Obnova překročí bezpečný limit 30 letů. Stávající záznamy nesmažu.", 0);
                var existingBytes = Directory.EnumerateFiles(_directory, "*",SearchOption.TopDirectoryOnly)
                    .Where(x => x.EndsWith(".meta.json",StringComparison.Ordinal) ||
                                x.EndsWith(".jsonl",StringComparison.Ordinal))
                    .Sum(x => new FileInfo(x).Length);

                var staged = new List<(string Id, string Data, string Metadata)>();
                long incomingBytes = 0;
                foreach (var flight in archive.Flights)
                {
                    var id=flight.Summary.StartedAtUtc.ToString("yyyyMMdd'T'HHmmss") + "-" +
                        Guid.NewGuid().ToString("N")[..12];
                    var data = string.Join(Environment.NewLine,
                        flight.Samples.Select(p => JsonSerializer.Serialize(p,JsonOptions))) +
                        Environment.NewLine;
                    // Recovered flight is always closed and gets a new ID:
                    // no source ID can cause overwrite of an existing recording.
                    var summary = flight.Summary with {
                        Id=id,Active=false,EndedAtUtc=flight.Summary.LastAtUtc,
                        Samples=flight.Samples.Count,
                        MaxAirspeedKnots=flight.Samples.Max(p=>p.AirspeedKnots),
                        MaxAltitudeFeet=flight.Samples.Max(p=>p.AltitudeFeet)
                    };
                    var meta=JsonSerializer.Serialize(summary,JsonOptions);
                    incomingBytes += System.Text.Encoding.UTF8.GetByteCount(data) +
                        System.Text.Encoding.UTF8.GetByteCount(meta);
                    if (incomingBytes + existingBytes > MaxTotalBytes)
                        return new(false,"Záloha překročí limit 100 MiB. Existující lety nemažu.",0);
                    staged.Add((id,data,meta));
                }

                // Commit each metadata file last. If any disk operation fails,
                // remove *only files this import created*, never pre-existing data.
                var owned = new List<string>();
                try
                {
                    foreach(var entry in staged)
                    {
                        var data=DataPath(entry.Id);
                        var meta=MetaPath(entry.Id);
                        using (var writer=new FileStream(data,FileMode.CreateNew,
                            FileAccess.Write,FileShare.None))
                        {
                            owned.Add(data);
                            using var buffered=new StreamWriter(writer);
                            buffered.Write(entry.Data);
                        }
                        using (var writer=new FileStream(meta,FileMode.CreateNew,
                            FileAccess.Write,FileShare.None))
                        {
                            owned.Add(meta);
                            using var buffered=new StreamWriter(writer);
                            buffered.Write(entry.Metadata);
                        }
                    }
                    logger.LogInformation("C49: restored {Count} archived flights; no existing flight replaced.",
                        staged.Count);
                    return new(true,"Lety byly obnoveny pod novými identifikátory.",staged.Count);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    foreach(var file in owned)
                    {
                        try {File.Delete(file);}catch(IOException){}catch(UnauthorizedAccessException){}
                    }
                    logger.LogWarning(ex,"C49 backup restore failed; transaction rolled back.");
                    return new(false,"Zápis zálohy selhal; nově vytvořené soubory byly odstraněny.",0);
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex,"C49 cannot inspect recording directory.");
                return new(false,"Úložiště letů není dostupné.",0);
            }
        }
    }
}
