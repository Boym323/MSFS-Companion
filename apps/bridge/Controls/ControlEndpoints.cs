using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Controls;

public sealed record LocalControlToggle(bool Enabled);
public sealed record PairRequest(string Code);

public static class ControlEndpoints
{
    public static void MapCockpitControls(this WebApplication app)
    {
        app.MapGet("/api/controls/status", (HttpContext http, ControlAccess access) =>
        {
            http.Response.Headers.CacheControl = "no-store";
            var token = http.Request.Headers["X-MSFS-Control-Token"].ToString();
            return Results.Ok(new { enabled = access.Enabled, paired = access.Authorized(token),
                local = ControlAccess.IsLoopback(http) });
        });

        app.MapGet("/api/controls/local", (HttpContext http, ControlAccess access) =>
        {
            if (!ControlAccess.IsLoopback(http)) return Results.StatusCode(403);
            http.Response.Headers.CacheControl = "no-store";
            return Results.Ok(new { enabled = access.Enabled, pairCode = access.LocalPairCode() });
        });

        app.MapPost("/api/controls/local", (HttpContext http, ControlAccess access, LocalControlToggle change) =>
        {
            if (!ControlAccess.IsLoopback(http) || !ControlAccess.SameOrigin(http)
                || http.Request.Headers["X-MSFS-Companion-Action"] != "control-local")
                return Results.StatusCode(403);
            access.SetEnabled(change.Enabled); // po vypnutí zruší všechny tokeny
            return Results.Ok(new { enabled = access.Enabled, pairCode = access.LocalPairCode() });
        });

        app.MapPost("/api/controls/pair", (HttpContext http, ControlAccess access, PairRequest input) =>
        {
            if (!ControlAccess.SameOrigin(http)) return Results.StatusCode(403);
            http.Response.Headers.CacheControl = "no-store";
            var token = access.Pair(input.Code);
            return token is null ? Results.Unauthorized() : Results.Ok(new { token, expiresInSeconds = 28800 });
        });

        app.MapPost("/api/controls/command", async (HttpContext http, ControlAccess access,
            TelemetryHealth health, ITelemetrySource telemetry, NativeCockpitEventSender sender,
            ControlCommand input) =>
        {
            if (!ControlAccess.SameOrigin(http)) return Results.StatusCode(403);
            var token = http.Request.Headers["X-MSFS-Control-Token"].ToString();
            if (!access.Authorized(token)) return Results.Unauthorized();
            if (!CockpitCommands.TryResolve(input, out var command) || command is null)
                return Results.BadRequest(new { error = "Nepovolený příkaz nebo hodnota." });
            if (telemetry.Mode != "simconnect" || !health.Snapshot(telemetry.Mode).Connected)
                return Results.Conflict(new { error = "MSFS 2020 není živě připojený." });
            if (!access.PermitCommand(token)) return Results.StatusCode(429);

            try
            {
                await sender.SendAsync(command, http.RequestAborted);
                // Vracet 'applied' by bylo chybné: skutečný stav ověřuje až zpětná telemetrie.
                return Results.Accepted(value: new { status = "sent", command = input.Command,
                    confirmation = "pending_telemetry" });
            }
            catch (OperationCanceledException) when (http.RequestAborted.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex) when (ex is System.Runtime.InteropServices.SEHException
                                       or System.Runtime.InteropServices.COMException
                                       or IOException
                                       or DllNotFoundException
                                       or PlatformNotSupportedException)
            {
                app.Logger.LogWarning(ex, "SimConnect odmítl kokpitní událost {Name}", command.Name);
                return Results.Problem("SimConnect ovládání není dostupné.", statusCode: 503);
            }
        });
    }
}
