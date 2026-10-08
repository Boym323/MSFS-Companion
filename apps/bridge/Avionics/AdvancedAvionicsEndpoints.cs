using MsfsCompanion.Bridge.Controls;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Avionics;

public sealed record AdvancedAvionicsCommand(string Id, double? Value);

public static class AdvancedAvionicsEndpoints
{
    public static void MapAdvancedAvionics(this WebApplication app)
    {
        app.MapGet("/api/avionics/advanced", async (TelemetryHealth health,
            ITelemetrySource source, G1000Service service, CancellationToken ct) =>
        {
            if (source.Mode != "simconnect" || !health.Snapshot(source.Mode).Connected)
                return Results.Ok(new G1000Availability("offline", null, null, [], null));
            return Results.Ok(await service.StatusAdvancedAsync(ct));
        });

        app.MapPost("/api/avionics/advanced/command", async (HttpContext http,
            ControlAccess access, TelemetryHealth health, ITelemetrySource source,
            G1000Service service, AdvancedAvionicsCommand command) =>
        {
            if (!ControlAccess.SameOrigin(http)) return Results.StatusCode(403);
            var token = http.Request.Headers["X-MSFS-Control-Token"].ToString();
            if (!access.CanControl(token)) return Results.Unauthorized();
            if (!AdvancedAvionicsCatalog.TryResolve(command.Id, command.Value, out _))
                return Results.BadRequest(new { error = "Nepovolený Input Event." });
            if (source.Mode != "simconnect" || !health.Snapshot(source.Mode).Connected)
                return Results.Conflict(new { error = "MSFS není připojen." });
            if (!access.PermitCommand(token)) return Results.StatusCode(429);
            try
            {
                var sent = await service.SendAdvancedAsync(command.Id, command.Value!.Value, http.RequestAborted);
                return sent ? Results.Accepted(value: new { status = "sent", confirmation = "not_verified" })
                    : Results.Conflict(new { error = "Input Event není dostupný pro aktuální letadlo." });
            }
            catch (OperationCanceledException) when (http.RequestAborted.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex)
            {
                app.Logger.LogWarning(ex, "Pokročilý Input Event není dostupný.");
                return Results.Problem("SimConnect Input Events nejsou dostupné.", statusCode: 503);
            }
        });
    }
}
