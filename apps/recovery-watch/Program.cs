using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

// Independent *bundled* process, copied to user AppData outside Velopack's
// /current directory. Does not install a service, driver or third-party app.
// OFF by default. A single guarded rollback attempt is possible only when
// a specifically opted-in MSFS Companion update crashes and no host remains.
internal static class Program
{
    private sealed record Pending(int Schema,string TargetVersion,DateTimeOffset ArmedAtUtc,
        string? PreviousVersion);
    private sealed record Candidate(int Schema,string Version,string Sha256,
        long Bytes,DateTimeOffset SavedAtUtc);
    private static readonly string Root=Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MSFS Companion");
    private static readonly string Recovery=Path.Combine(Root,"recovery");
    private static readonly string PendingPath=Path.Combine(Root,"pending-update.json");
    private static readonly string Manifest=Path.Combine(Recovery,"recovery-candidate.json");
    private static readonly string Package=Path.Combine(Recovery,"previous-full.nupkg");
    private static readonly string Log=Path.Combine(Root,"windows-host.log");

    private static bool Version(string? v) =>
        !string.IsNullOrWhiteSpace(v)&&v.Length<=32&&
        System.Text.RegularExpressions.Regex.IsMatch(v,@"^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$");

    private static void Write(string message)
    {
        try{
            Directory.CreateDirectory(Root);
            File.AppendAllText(Log,$"[{DateTimeOffset.UtcNow:O}] C42 watchdog: {message}{Environment.NewLine}");
        }catch(IOException){}catch(UnauthorizedAccessException){}
    }
    private static bool Same(string? a,string? b)=>
        Version(a)&&string.Equals(a,b,StringComparison.OrdinalIgnoreCase);

    private static bool ValidBackup(string previous)
    {
        try{
            if(!File.Exists(Package)||!File.Exists(Manifest)||
                new FileInfo(Manifest).Length>4096)return false;
            var marker=JsonSerializer.Deserialize<Candidate>(File.ReadAllText(Manifest));
            if(marker is null||marker.Schema!=1||!Same(marker.Version,previous)||
               marker.Sha256 is null||marker.Sha256.Length!=64||
               !marker.Sha256.All(Uri.IsHexDigit)||
               marker.Bytes<100000||marker.Bytes>400000000||
               new FileInfo(Package).Length!=marker.Bytes||
               marker.SavedAtUtc>DateTimeOffset.UtcNow.AddMinutes(5)||
               marker.SavedAtUtc<DateTimeOffset.UtcNow.AddDays(-90))return false;
            using var stream=File.OpenRead(Package);
            return string.Equals(Convert.ToHexString(SHA256.HashData(stream)),marker.Sha256,
                StringComparison.OrdinalIgnoreCase);
        }catch(Exception ex)when(ex is IOException or JsonException or UnauthorizedAccessException)
        {return false;}
    }

    private static Pending? ReadPending(string target,string previous)
    {
        try{
            if(!File.Exists(PendingPath)||new FileInfo(PendingPath).Length>4096)return null;
            var pending=JsonSerializer.Deserialize<Pending>(File.ReadAllText(PendingPath));
            return pending is {Schema:2}&&Same(pending.TargetVersion,target)
                &&Same(pending.PreviousVersion,previous)
                &&pending.ArmedAtUtc<=DateTimeOffset.UtcNow.AddMinutes(5)
                &&pending.ArmedAtUtc>DateTimeOffset.UtcNow.AddMinutes(-15)
                ?pending:null;
        }catch(Exception ex)when(ex is IOException or JsonException or UnauthorizedAccessException)
        {return null;}
    }
    private static bool HostRunning()
    {
        try{
            var processes=Process.GetProcessesByName("MsfsCompanion.WindowsHost");
            try{return processes.Length>0;}
            finally{foreach(var process in processes)process.Dispose();}
        }catch(Exception){return true;} // fail closed
    }
    private static bool NewVersionActuallyInstalled(string root,string target)
    {
        try{
            var exe=Path.Combine(root,"current","MsfsCompanion.WindowsHost.exe");
            if(!File.Exists(exe))return false;
            var product=FileVersionInfo.GetVersionInfo(exe).ProductVersion;
            return Same(product,target)||product is not null&&
                product.StartsWith(target+"+",StringComparison.OrdinalIgnoreCase);
        }catch(Exception){return false;}
    }
    private static bool DisableFurtherAutomaticUpdates()
    {
        try{
            Directory.CreateDirectory(Root);
            var path=Path.Combine(Root,"settings.json");
            var settings=File.Exists(path)
                ?JsonNode.Parse(File.ReadAllText(path)) as JsonObject :new JsonObject();
            if(settings is null)return false;
            settings["AutomaticUpdates"]=false;
            settings["EnableRecoveryWatchdog"]=false;
            var tmp=path+".recovery.tmp";
            File.WriteAllText(tmp,settings.ToJsonString());
            File.Move(tmp,path,overwrite:true);
            return true;
        }catch(Exception ex)when(ex is IOException or JsonException or UnauthorizedAccessException
            or InvalidOperationException){return false;}
    }

    private static async Task<int> Watch(string target,string previous,int originalPid,string updater)
    {
        if(!Version(target)||!Version(previous)||Same(target,previous)||
            Path.GetFileName(updater)!="Update.exe"||
            !Path.IsPathFullyQualified(updater)||!File.Exists(updater)||
            ReadPending(target,previous) is null)return 2;
        if(!ValidBackup(previous)){Write("no trustworthy offline package, monitoring disabled");return 3;}
        try{
            using var old=Process.GetProcessById(originalPid);
            if(!old.WaitForExit(60000)){Write("old host still running, abort");return 4;}
        }catch(ArgumentException){}catch(InvalidOperationException){} // host already exited
        // Velopack may need substantial time to extract self-contained .NET.
        for(var seconds=0;seconds<240;seconds+=3)
        {
            if(ReadPending(target,previous) is null){Write("new host confirmed or journal changed; exit");return 0;}
            await Task.Delay(3000);
        }
        if(ReadPending(target,previous) is null || HostRunning() ||
            !ValidBackup(previous) ||
            !NewVersionActuallyInstalled(Path.GetDirectoryName(updater)!,target))
        {Write("host running, source changed or installed target not proven; abort");return 5;}

        var marker=Path.Combine(Recovery,"attempt-"+target+".json");
        try{
            Directory.CreateDirectory(Recovery);
            // Atomically refuse repeated automatic downgrade attempts.
            using(var output=new FileStream(marker,FileMode.CreateNew,FileAccess.Write,FileShare.None))
            {
                JsonSerializer.Serialize(output,new {target,previous,atUtc=DateTimeOffset.UtcNow});
            }
            if(!DisableFurtherAutomaticUpdates())
            {Write("cannot safely disable future updates; abort");return 6;}
            var process=new ProcessStartInfo(updater){UseShellExecute=false,
                WorkingDirectory=Path.GetDirectoryName(updater)!};
            process.ArgumentList.Add("apply");
            process.ArgumentList.Add("--package");
            process.ArgumentList.Add(Package);
            Write("one-time rollback requested for "+target+" -> "+previous);
            if(Process.Start(process) is null)return 7;
            return 0;
        }catch(Exception ex)when(ex is IOException or UnauthorizedAccessException
            or InvalidOperationException or System.ComponentModel.Win32Exception)
        {Write("automatic rollback could not start: "+ex.GetType().Name);return 8;}
    }

    private static async Task<int> Main(string[] args)
    {
        if(args is ["--self-test"])
        {
            var valid=Version("0.2.128")&&!Version("../unsafe")&&
                !Version("v0.2.128")&&!Same("0.2.128","0.2.127");
            Console.WriteLine(valid?"C42 supervisor PASS":"C42 supervisor FAIL");
            return valid?0:1;
        }
        if(args.Length!=5||args[0]!="--watch"||
            !int.TryParse(args[3],out var parentPid)||parentPid<=0)
            return 2;
        return await Watch(args[1],args[2],parentPid,args[4]);
    }
}
