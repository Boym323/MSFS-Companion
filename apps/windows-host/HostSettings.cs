using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

internal sealed class HostSettings
{
    public string? UpdateFeedUrl { get; set; }
    public bool AutomaticUpdates { get; set; } = true;

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
                return JsonSerializer.Deserialize<HostSettings>(File.ReadAllText(FilePath)) ?? new();
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
