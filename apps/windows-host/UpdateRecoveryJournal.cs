using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// C33: souborová kontrola restartu hostitele po aktualizaci.
/// NEJDE o rollback: nezávislý watchdog ani automatická obnova staré binárky
/// nejsou součástí této etapy. Při selhání se deaktivuje další auto-update.
/// </summary>
internal static class UpdateRecoveryJournal
{
    internal sealed record Pending(int Schema, string TargetVersion, DateTimeOffset ArmedAtUtc);
    private static string Root => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MSFS Companion");
    private static string PathOnDisk => Path.Combine(Root,"pending-update.json");
    private static string FailedPath => Path.Combine(Root,"failed-update.json");

    internal static bool TryArm(string version)
    {
        if (!ValidVersion(version)) return false;
        try
        {
            Directory.CreateDirectory(Root);
            var json=JsonSerializer.Serialize(new Pending(1,version,DateTimeOffset.UtcNow));
            var temp=PathOnDisk+".tmp";
            File.WriteAllText(temp,json);
            File.Move(temp,PathOnDisk,overwrite:true);
            return true;
        }
        catch (Exception ex)
        {
            EventLogFile.Write("C33: nelze vytvořit update journal: "+ex.GetType().Name);
            return false;
        }
    }
    internal static Pending? Load()
    {
        try
        {
            if (!File.Exists(PathOnDisk))return null;
            var data=JsonSerializer.Deserialize<Pending>(File.ReadAllText(PathOnDisk));
            return IsValid(data)?data:null;
        }
        catch (Exception ex)
        {
            EventLogFile.Write("C33: journal nelze přečíst: "+ex.GetType().Name);
            return null;
        }
    }
    internal static void Confirm()
    {
        try {File.Delete(PathOnDisk);}catch(Exception ex)
        {EventLogFile.Write("C33: nelze potvrdit journal: "+ex.Message);}
    }
    internal static void MarkFailed()
    {
        try
        {
            if(File.Exists(PathOnDisk))File.Move(PathOnDisk,FailedPath,overwrite:true);
        }
        catch(Exception ex)
        {
            EventLogFile.Write("C33: nepodařilo se archivovat neověřenou aktualizaci: "+ex.Message);
        }
    }
    private static bool ValidVersion(string? version) =>
        !string.IsNullOrWhiteSpace(version)&&version.Length<=32
        &&version.All(c=>char.IsAsciiLetterOrDigit(c)||c is '.' or '-');
    private static bool IsValid(Pending? item) =>
        item is { Schema:1 } && ValidVersion(item.TargetVersion)
        &&item.ArmedAtUtc>DateTimeOffset.UtcNow.AddDays(-7)
        &&item.ArmedAtUtc<DateTimeOffset.UtcNow.AddMinutes(5);
    internal static bool SelfTest() =>
        ValidVersion("0.2.98")&&!ValidVersion("../feed")&&!ValidVersion(new string('x',33))
        &&!IsValid(new Pending(1,"0.2.100",DateTimeOffset.UtcNow.AddDays(-10)))
        &&IsValid(new Pending(1,"0.2.100",DateTimeOffset.UtcNow));
}
