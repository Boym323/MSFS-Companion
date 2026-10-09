using MsfsCompanion.Bridge.Recorder;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text.Json;

var root=Path.Combine(Path.GetTempPath(),"kokpit-recorder-restore-test-"+Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(root);
Environment.SetEnvironmentVariable("MSFS_COMPANION_RECORDINGS_DIR",root);
try
{
    using var recorder=new FlightRecorder(null!,null!,null!,null!,null!,
        NullLogger<FlightRecorder>.Instance);
    var start=new DateTimeOffset(2026,10,9,7,0,0,TimeSpan.Zero);
    var samples=new []{
        new FlightRecordedSample(start,"C172",50.1,14.2,105,2500,500,90,2,0),
        new FlightRecordedSample(start.AddSeconds(1),"C172",50.11,14.21,110,2600,400,91,1,0)
    };
    FlightDetail Make(string id="20261009T070000-abcdef012345",bool active=false,
        FlightRecordedSample[]? points=null) => new (
        new FlightSummary(id,"simconnect","C172",start,
            active?null:start.AddSeconds(1),start.AddSeconds(1),
            2,1100,110,2600,active),
        points??samples);
    FlightBackupArchive Archive(params FlightDetail[] flights) =>
        new("kokpit-flight-backup-v1",DateTimeOffset.UtcNow,flights);
    void Check(bool value,string message) { if(!value)throw new Exception(message); }

    var restored=recorder.RestoreArchive(Archive(Make()));
    Check(restored.Success&&restored.Imported==1,"valid archived flight restore failed");
    var stored=recorder.List();
    Check(stored.Count==1,"restored flight is not listed");
    Check(stored[0].Id!="20261009T070000-abcdef012345",
        "restoration reused original ID");
    Check(stored[0].Samples==2&&!stored[0].Active&&stored[0].EndedAtUtc is not null,
        "restored flight metadata invalid");
    var reread=recorder.Read(stored[0].Id);
    Check(reread?.Samples.Count==2&&reread.Samples[1].Longitude==14.21,
        "restored sample data mismatch");
    var before=File.ReadAllText(Path.Combine(root,stored[0].Id+".jsonl"));

    Check(!recorder.RestoreArchive(Archive(Make(active:true))).Success,
        "active archive should be refused");
    var unordered=new []{samples[1],samples[0]};
    Check(!recorder.RestoreArchive(Archive(Make(points:unordered))).Success,
        "unordered samples should be refused");
    Check(!recorder.RestoreArchive(Archive(Make(),Make())).Success,
        "duplicate original archive IDs should be refused");
    var full=Enumerable.Range(0,30)
        .Select(i=>Make("20261009T070000-"+i.ToString("x12"))).ToArray();
    Check(!recorder.RestoreArchive(Archive(full)).Success,
        "restore must refuse exceeding limit 30 without pruning");
    Check(recorder.List().Count==1 &&
        File.ReadAllText(Path.Combine(root,stored[0].Id+".jsonl"))==before,
        "failed restores must never alter existing recordings");
    // Simulate hard process termination after the import marker and one
    // restored data + metadata pair were durably written.
    var batch=Guid.NewGuid().ToString("N");
    var incompleteId="20261009T070000-"+Guid.NewGuid().ToString("N")[..12];
    var pending=Path.Combine(root,"restore-"+batch+".pending.json");
    File.WriteAllText(pending,JsonSerializer.Serialize(new {
        schema=1,batchId=batch,ids=new[]{incompleteId}}));
    var incompleteData=Path.Combine(root,incompleteId+".jsonl");
    var incompleteMeta=Path.Combine(root,incompleteId+".meta.json");
    File.WriteAllText(incompleteData,JsonSerializer.Serialize(samples[0]));
    File.WriteAllText(incompleteMeta,JsonSerializer.Serialize(new{
        restoreBatchId=batch,id=incompleteId,aircraft="C172"}));
    Check(recorder.RecoverInterruptedImports()==1,
        "orphaned transaction journal was not recovered");
    Check(!File.Exists(pending)&&!File.Exists(incompleteData)&&
        !File.Exists(incompleteMeta),"incomplete restore was not fully cleaned");
    Check(File.ReadAllText(Path.Combine(root,stored[0].Id+".jsonl"))==before,
        "crash recovery altered the already committed flight");
    // An untrusted marker referring to an unrelated existing flight MUST fail
    // closed without deleting any of its files.
    var tamperedBatch=Guid.NewGuid().ToString("N");
    var tamperedPath=Path.Combine(root,"restore-"+tamperedBatch+".pending.json");
    File.WriteAllText(tamperedPath,JsonSerializer.Serialize(new{
        schema=1,batchId=tamperedBatch,ids=new[]{stored[0].Id}}));
    var rejected=false;
    try{recorder.RecoverInterruptedImports();}
    catch(IOException){rejected=true;}
    Check(rejected&&File.ReadAllText(Path.Combine(root,stored[0].Id+".jsonl"))==before,
        "an untrusted marker deleted an unrelated flight");
    File.Delete(tamperedPath);
    Console.WriteLine("C49 restore PASS: atomic import, interrupted-batch recovery, "+
        "ownership validation, readback and no deletion of existing flights.");
}
finally
{
    Environment.SetEnvironmentVariable("MSFS_COMPANION_RECORDINGS_DIR",null);
    try{Directory.Delete(root,true);}catch(IOException){}
}
