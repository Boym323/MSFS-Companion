using MsfsCompanion.Bridge.Controls;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Avionics;

public sealed record G1000Command(string Id, double? Value);

public static class G1000Endpoints
{
    public static void MapG1000(this WebApplication app)
    {
        app.MapGet("/api/avionics/g1000", async (TelemetryHealth health, ITelemetrySource source,
            G1000Service service, CancellationToken ct) =>
        {
            if (source.Mode != "simconnect" || !health.Snapshot(source.Mode).Connected)
                return Results.Ok(new G1000Availability("offline", null, null, [], null));
            return Results.Ok(await service.StatusAsync(ct));
        });

        app.MapPost("/api/avionics/g1000/command", async (HttpContext http, ControlAccess access,
            TelemetryHealth health, ITelemetrySource source, G1000Service service, G1000Command command) =>
        {
            if (!ControlAccess.SameOrigin(http)) return Results.StatusCode(403);
            if (!access.CanControl(http.Request.Headers["X-MSFS-Control-Token"].ToString()))
                return Results.Unauthorized();
            if (!G1000Catalog.TryResolve(command.Id, command.Value, out _))
                return Results.BadRequest(new { error = "Nepovolený G1000 příkaz." });
            if (source.Mode != "simconnect" || !health.Snapshot(source.Mode).Connected)
                return Results.Conflict(new { error = "Simulátor není živě připojen." });
            if (!access.PermitCommand(http.Request.Headers["X-MSFS-Control-Token"].ToString()))
                return Results.StatusCode(429);
            try
            {
                var sent = await service.SendAsync(command.Id, command.Value!.Value, http.RequestAborted);
                return sent
                    ? Results.Accepted(value: new { status = "sent", confirmation = "not_verified" })
                    : Results.Conflict(new { error = "Událost není dostupná pro aktuální letadlo." });
            }
            catch (OperationCanceledException) when (http.RequestAborted.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex)
            {
                app.Logger.LogWarning(ex, "G1000 InputEvent nebylo možné odeslat.");
                return Results.Problem("Input Events jsou nedostupné.", statusCode: 503);
            }
        });
    }
}
