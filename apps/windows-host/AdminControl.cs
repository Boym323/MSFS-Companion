using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// Lokální komunikace s webovým bridge. Externí požadavky bridge kontroluje
/// podle privátní podsítě a původu stránky; tato třída zpracovává jen
/// předem definované požadavky na kontrolu aktualizací.
/// </summary>
internal static class AdminControl
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string ControlDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion", "control");

    public static bool HasPendingRequests()
    {
        if (!Directory.Exists(ControlDirectory))
            return false;

        // Limit processing to bounded set; only files placed by the authenticated
        // localhost API are actionable. Expired commands cannot restart an old host.
        foreach (var path in Directory.EnumerateFiles(ControlDirectory, "request-*.json").Take(32))
        {
            try
            {
                if (DateTime.UtcNow - File.GetCreationTimeUtc(path) > TimeSpan.FromMinutes(10))
                {
                    File.Delete(path);
                    continue;
                }

                File.Delete(path);
                return true;
            }
            catch (IOException ex)
            {
                EventLogFile.Write($"Nelze zpracovat požadavek na aktualizaci: {ex.Message}");
            }
        }
        return false;
    }

    public static void WriteStatus(string state, string message, string? targetVersion = null)
    {
        try
        {
            Directory.CreateDirectory(ControlDirectory);
            var status = Path.Combine(ControlDirectory, "update-status.json");
            var temporary = status + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(temporary, JsonSerializer.Serialize(new
            {
                state,
                message,
                targetVersion,
                currentVersion = typeof(AdminControl).Assembly.GetName().Version?.ToString(3) ?? "neznámá",
                updatedAtUtc = DateTimeOffset.UtcNow
            }, JsonOptions));
            File.Move(temporary, status, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            EventLogFile.Write($"Zápis stavu aktualizací selhal: {ex.Message}");
        }
    }
}
