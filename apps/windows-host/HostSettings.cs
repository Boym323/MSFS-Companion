using System.Text.Json;
using System.Text.Json.Serialization;

namespace MsfsCompanion.WindowsHost;

internal sealed class HostSettings
{
    public const string DefaultFeedUrl = "https://github.com/Boym323/MSFS-Companion";
    public string? UpdateFeedUrl { get; set; } = DefaultFeedUrl;
    public bool AutomaticUpdates { get; set; } = true;
    // Deliberately opt-in until recovery of two real Windows versions is proven.
    public bool EnableRecoveryWatchdog { get; set; } = false;
    public bool MdnsEnabled { get; set; } = true;
    public const string DefaultMdnsName = "kokpit";
    public string MdnsName { get; set; } = DefaultMdnsName;
    [JsonIgnore]
    public string MdnsHostName => MdnsName + ".local";
    public string TelemetryMode { get; set; } = "simconnect";

    private static string FilePath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion",
        "settings.json");

    public static HostSettings Load()
    {
        try
        {
            if (File.Exists(FilePath))
            {
                var settings = JsonSerializer.Deserialize<HostSettings>(File.ReadAllText(FilePath)) ?? new();
                if (string.IsNullOrWhiteSpace(settings.UpdateFeedUrl))
                    settings.UpdateFeedUrl = DefaultFeedUrl;
                if (!TryNormalizeMdnsName(settings.MdnsName, out var mdnsName, out _))
                    mdnsName = DefaultMdnsName;
                settings.MdnsName = mdnsName;
                if (settings.TelemetryMode is not ("simconnect" or "mock"))
                    settings.TelemetryMode = "simconnect";
                return settings;
            }
        }
        catch (Exception ex)
        {
            EventLogFile.Write($"Settings load failed: {ex.Message}");
        }

        return new();
    }

    public void Save()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
        var tmp = FilePath + ".tmp";
        File.WriteAllText(tmp, JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true }));
        File.Move(tmp, FilePath, overwrite: true);
    }

    public static bool TryNormalizeMdnsName(string? name, out string normalized, out string error)
    {
        normalized = (name ?? "").Trim().ToLowerInvariant();
        error = "";
        // Jeden DNS hostname label, žádná IP ani úplná adresa; .local se přidává automaticky.
        if (normalized.Length is < 1 or > 63 ||
            normalized[0] == '-' || normalized[^1] == '-' ||
            normalized == "localhost" ||
            normalized.Any(c => !(c is >= 'a' and <= 'z' or >= '0' and <= '9' or '-')))
        {
            error = "Použijte 1–63 znaků: písmena a–z, číslice nebo spojovník uvnitř názvu. Bez .local.";
            return false;
        }
        return true;
    }

    public static bool TryValidateFeed(string url, out string message)
    {
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps
            || string.IsNullOrWhiteSpace(uri.Host)
            || uri.UserInfo.Length > 0)
        {
            message = "Je vyžadována HTTPS adresa bez přihlašovacích údajů.";
            return false;
        }

        message = "";
        return true;
    }
}

internal static class EventLogFile
{
    private static readonly object Gate = new();
    public static string PathOnDisk => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion", "windows-host.log");

    public static void Write(string text)
    {
        try
        {
            lock (Gate)
            {
                Directory.CreateDirectory(Path.GetDirectoryName(PathOnDisk)!);
                File.AppendAllText(PathOnDisk, $"[{DateTimeOffset.Now:O}] {text}{Environment.NewLine}");
            }
        }
        catch
        {
            // Filesystem errors must not stop the tray or the simulator.
        }
    }
}
