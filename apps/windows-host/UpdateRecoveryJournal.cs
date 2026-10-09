using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// C33: souborová kontrola restartu hostitele po aktualizaci.
/// NEJDE o rollback: nezávislý watchdog ani automatická obnova staré binárky
/// nejsou součástí této etapy. Při selhání se deaktivuje další auto-update.
/// </summary>
internal static class UpdateRecoveryJournal
{
    internal sealed record Pending(int Schema, string TargetVersion, DateTimeOffset ArmedAtUtc,
        string? PreviousVersion = null);
    internal sealed record LastVerified(int Schema, string Version, DateTimeOffset VerifiedAtUtc);
    private static string Root => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MSFS Companion");
    private static string PathOnDisk => Path.Combine(Root,"pending-update.json");
    private static string FailedPath => Path.Combine(Root,"failed-update.json");
    private static string VerifiedPath => Path.Combine(Root,"last-verified-update.json");

    // Schema 2 records the previous installed version. This is *metadata*
    // for future recovery; it does not install or roll back binaries.
    // Schema 1 remains supported for older pending journals and portable mode.
    internal static bool TryArm(string version, string? previousVersion = null)
    {
        if (!ValidVersion(version) ||
            previousVersion is not null && (!ValidVersion(previousVersion) ||
                string.Equals(version,previousVersion,StringComparison.OrdinalIgnoreCase))) return false;
        try
        {
            Directory.CreateDirectory(Root);
            var json=JsonSerializer.Serialize(new Pending(
                previousVersion is null ? 1 : 2,version,DateTimeOffset.UtcNow,previousVersion));
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
    // Pokud pending soubor existuje, ale nelze jej validovat, nesmí být
    // předchozí aktualizace omylem považována za potvrzenou.
    internal static bool HasPendingAttempt()
    {
        try { return File.Exists(PathOnDisk); }
        catch (Exception ex)
        {
            EventLogFile.Write("C33: nelze zjistit stav journalu: "+ex.GetType().Name);
            return true; // fail closed
        }
    }

    internal static bool NeedsQuarantine(bool pendingExists, Pending? validPending) =>
        pendingExists && validPending is null;

    // Lokální HTTP readiness není důkaz, že je instalována požadovaná verze.
    // Při neznámé nebo jiné verzi zůstává pokus neověřený.
    internal static bool MatchesTargetVersion(string? target, string? installed) =>
        ValidVersion(target) && ValidVersion(installed) &&
        string.Equals(target, installed, StringComparison.OrdinalIgnoreCase);

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
        try
        {
            var pending = Load();
            if(pending is not null)
            {
                // Durable evidence of the version only *after* matching the
                // local installation and successfully probing health + web.
                var verified = new LastVerified(1,pending.TargetVersion,DateTimeOffset.UtcNow);
                var temp = VerifiedPath + ".tmp";
                Directory.CreateDirectory(Root);
                File.WriteAllText(temp,JsonSerializer.Serialize(verified));
                File.Move(temp,VerifiedPath,overwrite:true);
            }
            File.Delete(PathOnDisk);
        }
        catch (Exception ex)
        {
            // Do not falsely claim a confirmed version if journaling failed.
            EventLogFile.Write("C42: nelze uložit potvrzení aktualizace: "+ex.GetType().Name);
        }
    }
    internal static LastVerified? ReadLastVerified()
    {
        try
        {
            if(!File.Exists(VerifiedPath)||new FileInfo(VerifiedPath).Length>4096)return null;
            var value=JsonSerializer.Deserialize<LastVerified>(File.ReadAllText(VerifiedPath));
            return IsValidVerified(value)?value:null;
        }
        catch(Exception ex)
        {
            EventLogFile.Write("C42: nelze ověřit verzi poslední úspěšné instalace: "+ex.GetType().Name);
            return null;
        }
    }
    // Only before an updater process has been launched. A failed supervisor
    // start must never leave a pending update masquerading as an in-flight one.
    internal static bool CancelBeforeApply(string target,string previous)
    {
        try
        {
            var pending=Load();
            if(pending is not {Schema:2} ||
               !MatchesTargetVersion(target,pending.TargetVersion) ||
               !MatchesTargetVersion(previous,pending.PreviousVersion))
                return false;
            File.Delete(PathOnDisk);
            return !File.Exists(PathOnDisk);
        }
        catch(Exception ex)
        {
            EventLogFile.Write("C42: nelze zrušit nenastartovanou aktualizaci: "+
                ex.GetType().Name);
            return false;
        }
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
        item is not null && item.Schema is 1 or 2 && ValidVersion(item.TargetVersion)
        &&(item.Schema==1 && item.PreviousVersion is null ||
           item.Schema==2 && ValidVersion(item.PreviousVersion)
             &&!string.Equals(item.PreviousVersion,item.TargetVersion,StringComparison.OrdinalIgnoreCase))
        &&item.ArmedAtUtc>DateTimeOffset.UtcNow.AddDays(-7)
        &&item.ArmedAtUtc<DateTimeOffset.UtcNow.AddMinutes(5);
    private static bool IsValidVerified(LastVerified? item) =>
        item is {Schema:1} && ValidVersion(item.Version)
        &&item.VerifiedAtUtc<=DateTimeOffset.UtcNow.AddMinutes(5)
        &&item.VerifiedAtUtc>DateTimeOffset.UtcNow.AddYears(-2);
    internal static bool SelfTest() =>
        ValidVersion("0.2.98")&&!ValidVersion("../feed")&&!ValidVersion(new string('x',33))
        &&!IsValid(new Pending(1,"0.2.100",DateTimeOffset.UtcNow.AddDays(-10)))
        &&IsValid(new Pending(1,"0.2.100",DateTimeOffset.UtcNow))
        &&IsValid(new Pending(2,"0.2.101",DateTimeOffset.UtcNow,"0.2.100"))
        &&!IsValid(new Pending(2,"0.2.101",DateTimeOffset.UtcNow))
        &&!IsValid(new Pending(2,"0.2.101",DateTimeOffset.UtcNow,"0.2.101"))
        &&IsValidVerified(new LastVerified(1,"0.2.100",DateTimeOffset.UtcNow))
        &&!IsValidVerified(new LastVerified(1,"../x",DateTimeOffset.UtcNow))
        &&NeedsQuarantine(true,null)
        &&!NeedsQuarantine(false,null)
        &&!NeedsQuarantine(true,new Pending(1,"0.2.100",DateTimeOffset.UtcNow))
        &&MatchesTargetVersion("0.2.100","0.2.100")
        &&!MatchesTargetVersion("0.2.100","0.2.99")
        &&!MatchesTargetVersion("0.2.100",null)
        &&!MatchesTargetVersion("0.2.100","../0.2.100");
}
