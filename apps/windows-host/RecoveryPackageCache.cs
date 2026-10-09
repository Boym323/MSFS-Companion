using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// C42: copy an already installed full Velopack package OUTSIDE the volatile
/// /current folder before applying an update. This is a recovery candidate,
/// not a watchdog and not evidence the updater can install this old package.
/// </summary>
internal static class RecoveryPackageCache
{
    internal sealed record Candidate(int Schema, string Version, string Sha256,
        long Bytes, DateTimeOffset SavedAtUtc);

    private static string BasePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion", "recovery");
    private static string Manifest => Path.Combine(BasePath,"recovery-candidate.json");
    private static string Package => Path.Combine(BasePath,"previous-full.nupkg");
    private static string? SafeVersion(string? version) =>
        !string.IsNullOrWhiteSpace(version)&&version.Length<=32&&
        version.All(c=>char.IsAsciiLetterOrDigit(c)||c is '.' or '-') ? version:null;

    private static string? InstallationRoot()
    {
        var current=Path.TrimEndingDirectorySeparator(AppContext.BaseDirectory);
        if(!Path.GetFileName(current).Equals("current",StringComparison.OrdinalIgnoreCase))
            return null;
        var parent=Directory.GetParent(current)?.FullName;
        return parent is not null && File.Exists(Path.Combine(parent,"Update.exe"))
            ?parent:null;
    }

    internal static bool TryCapture(string? installedVersion)
    {
        var version=SafeVersion(installedVersion);
        var root=InstallationRoot();
        if(version is null||root is null)return false;
        try
        {
            var packages=Path.Combine(root,"packages");
            if(!Directory.Exists(packages))return false;
            var matches=Directory.EnumerateFiles(packages,"*-full.nupkg")
                .Where(file=>Path.GetFileName(file).EndsWith(
                    "-"+version+"-full.nupkg",StringComparison.OrdinalIgnoreCase))
                .Take(2).ToArray();
            if(matches.Length!=1)return false;
            var source=matches[0];
            var bytes=new FileInfo(source).Length;
            if(bytes<100_000 || bytes>400_000_000)return false;
            using(var zip=ZipFile.OpenRead(source))
            {
                if(!zip.Entries.Any(x=>x.FullName.EndsWith(".nuspec",
                    StringComparison.OrdinalIgnoreCase)))return false;
            }
            Directory.CreateDirectory(BasePath);
            var temporary=Package+".tmp";
            try
            {
                File.Copy(source,temporary,overwrite:true);
                var sha=Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(temporary)));
                if(new FileInfo(temporary).Length!=bytes)return false;
                File.Move(temporary,Package,overwrite:true);
                var marker=new Candidate(1,version,sha,bytes,DateTimeOffset.UtcNow);
                var manifestTmp=Manifest+".tmp";
                File.WriteAllText(manifestTmp,JsonSerializer.Serialize(marker));
                File.Move(manifestTmp,Manifest,overwrite:true);
                EventLogFile.Write("C42: offline package captured for manually supervised recovery: "+version);
                return true;
            }
            finally {try{File.Delete(temporary);}catch(IOException){}}
        }
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or InvalidDataException)
        {
            EventLogFile.Write("C42: cannot capture previous package: "+ex.GetType().Name);
            return false;
        }
    }

    internal static string? VerifiedPackage()
    {
        try
        {
            if(!File.Exists(Manifest)||new FileInfo(Manifest).Length>4096||!File.Exists(Package))
                return null;
            var item=JsonSerializer.Deserialize<Candidate>(File.ReadAllText(Manifest));
            if(item is not {Schema:1}||SafeVersion(item.Version)is null||
                item.Sha256.Length!=64||!item.Sha256.All(Uri.IsHexDigit)||
                item.Bytes<100_000||item.Bytes>400_000_000||
                item.SavedAtUtc>DateTimeOffset.UtcNow.AddMinutes(5)||
                item.SavedAtUtc<DateTimeOffset.UtcNow.AddDays(-90)||
                new FileInfo(Package).Length!=item.Bytes)return null;
            var digest=Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(Package)));
            return string.Equals(digest,item.Sha256,StringComparison.OrdinalIgnoreCase)
                ?Package:null;
        }
        catch(Exception ex) when(ex is IOException or UnauthorizedAccessException or JsonException)
        {
            EventLogFile.Write("C42: recovery package integrity failed: "+ex.GetType().Name);
            return null;
        }
    }

    internal static string? LocalUpdater()
    {
        var root=InstallationRoot();
        return root is null?null:Path.Combine(root,"Update.exe");
    }

    internal static bool SelfTest() =>
        SafeVersion("0.2.123")=="0.2.123"&&SafeVersion("../unsafe") is null
        &&SafeVersion(new string('x',33)) is null;
}
