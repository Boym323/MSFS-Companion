using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace MsfsCompanion.Bridge.Recorder;

// This schema matches the already-exported Kokpit C49 JSON. No extra fields
// may be interpreted as requests to overwrite or delete existing flights.
public sealed record FlightBackupArchive(
    string Schema, DateTimeOffset ExportedAtUtc, IReadOnlyList<FlightDetail> Flights);
public sealed record FlightRestoreResult(bool Success, string Message, int Imported);

public sealed partial class FlightRecorder
{
    private sealed record RestoreMarker(int Schema,string BatchId,string[] Ids);
    private static readonly Regex ValidBatch = new(
        @"\A[0-9a-f]{32}\z",RegexOptions.Compiled | RegexOptions.CultureInvariant);

    // A pre-commit marker survives process termination. Only IDs belonging to
    // this batch may be touched; existing flights must never be overwritten.
    private string MarkerPath(string batch) =>
        Path.Combine(_directory,"restore-"+batch+".pending.json");

    public int RecoverInterruptedImports()
    {
        lock(_gate)
        {
            Directory.CreateDirectory(_directory);
            return RecoverInterruptedImportsLocked();
        }
    }

    private int RecoverInterruptedImportsLocked()
    {
        var recovered=0;
        foreach(var path in Directory.EnumerateFiles(_directory,"restore-*.pending.json"))
        {
            var file=Path.GetFileName(path);
            const string prefix="restore-";
            const string suffix=".pending.json";
            var batch=file[prefix.Length..^suffix.Length];
            if(!ValidBatch.IsMatch(batch)||new FileInfo(path).Length>4096)
                throw new IOException("Invalid C49 import recovery marker.");
            RestoreMarker? marker;
            try {marker=JsonSerializer.Deserialize<RestoreMarker>(
                File.ReadAllText(path),JsonOptions);}
            catch(JsonException ex){throw new IOException("Invalid C49 import journal.",ex);}
            if(marker is not {Schema:1}||marker.BatchId!=batch||
                marker.Ids is null||marker.Ids.Length is < 1 or > 30||
                marker.Ids.Any(id=>!ValidId.IsMatch(id))||
                marker.Ids.Distinct(StringComparer.Ordinal).Count()!=marker.Ids.Length)
                throw new IOException("Invalid C49 import ownership journal.");
            // Preflight the ENTIRE batch before deleting anything: malformed or
            // unrelated metadata must fail closed without touching old flights.
            foreach(var id in marker.Ids)
            {
                var meta=MetaPath(id);
                if(!File.Exists(meta))continue;
                try
                {
                    using var json=JsonDocument.Parse(File.ReadAllText(meta));
                    if(!json.RootElement.TryGetProperty("restoreBatchId",out var owner)||
                       owner.GetString()!=batch)
                        throw new IOException("C49 marker does not own recorded flight.");
                }
                catch(JsonException ex){throw new IOException("Invalid C49 restored flight marker.",ex);}
            }
            foreach(var id in marker.Ids)
            {
                var meta=MetaPath(id);
                var data=DataPath(id);
                if(File.Exists(meta))File.Delete(meta);
                if(File.Exists(data))File.Delete(data);
            }
            File.Delete(path);
            recovered++;
            logger.LogWarning("C49: removed incomplete restored flight batch {Batch}.",batch);
        }
        return recovered;
    }

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
                RecoverInterruptedImportsLocked();
                var existing = Directory.EnumerateFiles(_directory, "*.meta.json").ToArray();
                if (existing.Length + archive.Flights.Count > MaxFlights)
                    return new(false, "Obnova překročí bezpečný limit 30 letů. Stávající záznamy nesmažu.", 0);
                var existingBytes = Directory.EnumerateFiles(_directory, "*",SearchOption.TopDirectoryOnly)
                    .Where(x => x.EndsWith(".meta.json",StringComparison.Ordinal) ||
                                x.EndsWith(".jsonl",StringComparison.Ordinal))
                    .Sum(x => new FileInfo(x).Length);

                var batch=Guid.NewGuid().ToString("N");
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
                    // Unknown metadata fields are ignored by legacy readers;
                    // this ownership token makes crash recovery fail closed.
                    var metaObject=JsonSerializer.SerializeToNode(summary,JsonOptions)!.AsObject();
                    metaObject["restoreBatchId"]=batch;
                    var meta=metaObject.ToJsonString();
                    incomingBytes += System.Text.Encoding.UTF8.GetByteCount(data) +
                        System.Text.Encoding.UTF8.GetByteCount(meta);
                    if (incomingBytes + existingBytes > MaxTotalBytes)
                        return new(false,"Záloha překročí limit 100 MiB. Existující lety nemažu.",0);
                    staged.Add((id,data,meta));
                }

                // Durable marker is written BEFORE the first flight file.
                // After a hard power loss, startup rolls back the entire
                // unconfirmed batch, including already visible metadata.
                var markerPath=MarkerPath(batch);
                var owned = new List<string>();
                var markerCreated=false;
                try
                {
                    using(var markerFile=new FileStream(markerPath,FileMode.CreateNew,
                        FileAccess.Write,FileShare.None))
                    {
                        markerCreated=true;
                        JsonSerializer.Serialize(markerFile,
                            new RestoreMarker(1,batch,staged.Select(x=>x.Id).ToArray()),JsonOptions);
                        markerFile.Flush(flushToDisk:true);
                    }
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
                    File.Delete(markerPath); // Commit: only complete batches become permanent.
                    logger.LogInformation("C49: restored {Count} archived flights; no existing flight replaced.",
                        staged.Count);
                    return new(true,"Lety byly obnoveny pod novými identifikátory.",staged.Count);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
                {
                    var cleanupSucceeded=true;
                    foreach(var file in owned)
                    {
                        try {File.Delete(file);}
                        catch(Exception removeEx) when(removeEx is IOException or UnauthorizedAccessException)
                        {cleanupSucceeded=false;}
                    }
                    if(markerCreated&&cleanupSucceeded)
                    {
                        try {File.Delete(markerPath);}
                        catch(Exception removeEx) when(removeEx is IOException or UnauthorizedAccessException)
                        {cleanupSucceeded=false;}
                    }
                    logger.LogWarning(ex,"C49 backup restore failed; cleanup complete: {Complete}.",cleanupSucceeded);
                    return new(false,cleanupSucceeded
                        ?"Zápis zálohy selhal; nově vytvořené soubory byly odstraněny."
                        :"Zápis zálohy selhal; při dalším startu se dokončí vyčištění nedokončeného importu.",0);
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
