using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MsfsCompanion.Bridge.Admin;

/// <summary>
/// Správcovské rozhraní je dostupné jen s klíčem předaným hostitelem Windows.
/// Na Macu nebo při samostatném spuštění bridge zůstávají cesty vypnuté (404).
/// </summary>
internal static class AdminUpdateEndpoints
{
    public static void MapAdminUpdates(this WebApplication app)
    {
        var secret = Environment.GetEnvironmentVariable("MSFS_COMPANION_ADMIN_TOKEN");
        var directory = Environment.GetEnvironmentVariable("MSFS_COMPANION_CONTROL_DIR");
        if (string.IsNullOrEmpty(secret) || secret.Length < 32 || string.IsNullOrEmpty(directory))
            return;

        bool Authorized(HttpContext context)
        {
            context.Response.Headers.CacheControl = "no-store";
            var authorization = context.Request.Headers.Authorization.ToString();
            if (!authorization.StartsWith("Bearer ", StringComparison.Ordinal))
                return false;
            var supplied = Encoding.UTF8.GetBytes(authorization["Bearer ".Length..]);
            var expected = Encoding.UTF8.GetBytes(secret);
            return supplied.Length == expected.Length
                && CryptographicOperations.FixedTimeEquals(supplied, expected);
        }

        app.MapGet("/api/admin/updates/status", (HttpContext context) =>
        {
            if (!Authorized(context))
                return Results.Unauthorized();

            var statusPath = Path.Combine(directory, "update-status.json");
            if (!File.Exists(statusPath))
                return Results.Ok(new { state = "initializing", message = "Čekám na správce aktualizací." });

            try
            {
                // The status file is owned by the local companion process, not an HTTP client.
                using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
                return Results.Json(document.RootElement.Clone());
            }
            catch (Exception ex) when (ex is IOException or JsonException)
            {
                return Results.Problem(statusCode: 503, detail: "Stav aktualizací se právě načítá.");
            }
        });

        app.MapPost("/api/admin/updates/check", (HttpContext context) =>
        {
            if (!Authorized(context))
                return Results.Unauthorized();

            var id = Guid.NewGuid().ToString("N");
            var requestFile = Path.Combine(directory, "request-" + id + ".json");
            try
            {
                Directory.CreateDirectory(directory);
                // A random, unique file cannot overwrite a concurrent command.
                using var output = new FileStream(requestFile, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                JsonSerializer.Serialize(output, new { id, requestedAtUtc = DateTimeOffset.UtcNow });
                return Results.Accepted(value: new { accepted = true, requestId = id,
                    message = "Požadavek na kontrolu aktualizací byl předán aplikaci Windows." });
            }
            catch (IOException)
            {
                return Results.Problem(statusCode: 503, detail: "Správce aktualizací není připraven.");
            }
        });
    }
}
