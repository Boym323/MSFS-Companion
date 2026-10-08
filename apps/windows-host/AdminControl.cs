using System.Security.Cryptography;
using System.Text.Json;

namespace MsfsCompanion.WindowsHost;

/// <summary>
/// Lokální komunikace s webovým bridge. Síťové požadavky autorizuje bridge;
/// tato třída pracuje pouze se soubory v profilu aktuálního uživatele.
/// </summary>
internal static class AdminControl
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string ControlDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion", "control");

    private static string TokenPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MSFS Companion", "admin-access.token");

    public static string GetOrCreateToken()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(TokenPath)!);
        try
        {
            using var stream = new FileStream(TokenPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            var generated = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            using var writer = new StreamWriter(stream);
            writer.Write(generated);
            writer.Flush();
            return generated;
        }
        catch (IOException) when (File.Exists(TokenPath))
        {
            var existing = File.ReadAllText(TokenPath).Trim();
            if (existing.Length == 64 && existing.All(Uri.IsHexDigit))
                return existing;
            throw new InvalidDataException("Neplatný správcovský klíč. Klíč musí být obnoven ručně.");
        }
    }

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
