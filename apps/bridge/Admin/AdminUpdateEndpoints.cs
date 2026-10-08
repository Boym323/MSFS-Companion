using System.Text.Json;

namespace MsfsCompanion.Bridge.Admin;

/// <summary>
/// Stav a požadavek na kontrolu aktualizací v rámci soukromé LAN.
/// Při samostatném spuštění bridge nejsou tyto endpointy registrované.
/// </summary>
internal static class AdminUpdateEndpoints
{
    public static void MapAdminUpdates(this WebApplication app)
    {
        var directory = Environment.GetEnvironmentVariable("MSFS_COMPANION_CONTROL_DIR");
        if (string.IsNullOrWhiteSpace(directory))
            return;

        app.MapGet("/api/admin/updates/status", (HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            var statusPath = Path.Combine(directory, "update-status.json");
            if (!File.Exists(statusPath))
                return Results.Ok(new { state = "initializing", message = "Čekám na správce aktualizací." });

            try
            {
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
            context.Response.Headers.CacheControl = "no-store";
            if (!LanRequestPolicy.AllowsUpdateRequest(context))
                return Results.StatusCode(StatusCodes.Status403Forbidden);

            try
            {
                Directory.CreateDirectory(directory);
                // Nepřidáváme opakované příkazy, pokud jeden čeká na zpracování.
                if (Directory.EnumerateFiles(directory, "request-*.json").Any())
                    return Results.Accepted(value: new
                    {
                        accepted = true,
                        message = "Požadavek na aktualizaci již čeká na zpracování."
                    });

                var id = Guid.NewGuid().ToString("N");
                var requestFile = Path.Combine(directory, "request-" + id + ".json");
                using var output = new FileStream(requestFile, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                JsonSerializer.Serialize(output, new { id, requestedAtUtc = DateTimeOffset.UtcNow });
                return Results.Accepted(value: new
                {
                    accepted = true,
                    requestId = id,
                    message = "Požadavek na kontrolu aktualizací byl předán Windows aplikaci."
                });
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return Results.Problem(statusCode: 503, detail: "Správce aktualizací není připraven.");
            }
        });
    }
}
