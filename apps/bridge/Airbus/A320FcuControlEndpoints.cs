using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Controls;
using MsfsCompanion.Bridge.Telemetry;
using System.Runtime.InteropServices;

namespace MsfsCompanion.Bridge.Airbus;

public static class A320FcuControlEndpoints
{
    public sealed record ArmRequest(bool Enabled);

    public static void MapA320FcuControls(this WebApplication app)
    {
        static bool Connected(ITelemetrySource source, TelemetryHealth health) =>
            source.Mode == "simconnect" && health.Snapshot(source.Mode).Connected;

        static bool Trusted(AircraftIdentityGuard identity, TelemetryStore telemetry) =>
            identity.Trusted(telemetry.Current.Aircraft, DateTimeOffset.UtcNow) &&
            AircraftProfileResolver.Resolve(identity.Current.Title).Id == "a320-asobo-candidate";

        app.MapGet("/api/a320/controls/status", (HttpContext ctx,
            A320FcuControlGate gate, AircraftIdentityGuard identity,
            ITelemetrySource source, TelemetryHealth health,
            TelemetryStore telemetry, A320ReadbackStore readbacks) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            var now = DateTimeOffset.UtcNow;
            var trusted = Connected(source, health) && Trusted(identity, telemetry);
            var fresh = trusted ? readbacks.FreshFcu(now) : null;
            var armed = trusted && fresh is not null &&
                gate.Armed(identity.Generation, identity.Current.Title, now);
            return Results.Ok(new
            {
                armed, canArm = trusted && fresh is not null &&
                    ControlAccess.IsLoopback(ctx),
                local = ControlAccess.IsLoopback(ctx),
                ready = armed && fresh is not null,
                aircraft = trusted ? identity.Current.Title : null,
                readbackFresh = fresh is not null,
                policy = "asobo_candidate_legacy_keys_manual_opt_in",
                commands = A320FcuCommandPolicy.Actions,
                evidence = gate.Evidence(identity.Generation, identity.Current.Title,
                    now, fresh),
                note = "Pouze vybrané referenční SimVars. Potvrzení transportu ani změna SimVar nezaručuje FCU/FMA; managed/selected a AP1/AP2 se neovládají."
            });
        });

        app.MapPost("/api/a320/controls/arm", (HttpContext ctx,
            A320FcuControlGate gate, AircraftIdentityGuard identity,
            ITelemetrySource source, TelemetryHealth health,
            TelemetryStore telemetry, A320ReadbackStore readbacks,
            ArmRequest input) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            if (!ControlAccess.IsLoopback(ctx) || !ControlAccess.SameOrigin(ctx) ||
                ctx.Request.Headers["X-MSFS-Companion-Action"] != "a320-fcu-arm")
                return Results.StatusCode(403);

            if (!input.Enabled)
            {
                gate.Disarm();
                return Results.Ok(new { armed = false });
            }
            if (!Connected(source, health) || !Trusted(identity, telemetry) ||
                readbacks.FreshFcu(DateTimeOffset.UtcNow) is null)
                return Results.Conflict(new { error = "Zkontrolujte A320, TITLE a čerstvý FCU readback. Bez něj nelze ovládání aktivovat." });

            gate.Arm(identity.Generation, identity.Current.Title!, DateTimeOffset.UtcNow);
            app.Logger.LogWarning(
                "Pilot locally enabled unverified Asobo A320 legacy reference events for the current aircraft generation.");
            return Results.Ok(new { armed = true, expiresInSeconds = 1800,
                note = "Experimentální referenční Key Events. Ověřujte skutečné FCU v simulátoru." });
        });

        app.MapPost("/api/a320/controls/command", async (HttpContext ctx,
            A320FcuCommandPolicy.Selection input, A320FcuControlGate gate,
            AircraftIdentityGuard identity, ITelemetrySource source,
            TelemetryHealth health, TelemetryStore telemetry,
            A320ReadbackStore readbacks, ControlAccess access,
            NativeCockpitEventSender sender) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            if (!ControlAccess.SameOrigin(ctx))
                return Results.StatusCode(403);
            if (!A320FcuCommandPolicy.TryResolve(input, out var mapped) ||
                mapped is null)
                return Results.BadRequest(new { error = "Nepodporovaná FCU reference nebo hodnota." });
            if (!access.CanControl(ctx.Request.Headers["X-MSFS-Control-Token"].ToString()))
                return Results.Unauthorized();
            var now = DateTimeOffset.UtcNow;
            if (!Connected(source, health) || !Trusted(identity, telemetry))
                return Results.Conflict(new { error = "Asobo A320 / identita / SimConnect nejsou ověřené." });
            var title = identity.Current.Title;
            var generation = identity.Generation;
            var readback = readbacks.FreshFcu(now);
            if (readback is null || !gate.Armed(generation, title, now))
                return Results.Conflict(new { error = "FCU není čerstvé nebo pilot nepotvrdil lokální aktivaci ovládání." });
            if (!access.PermitCommand(ctx.Request.Headers["X-MSFS-Control-Token"].ToString()))
                return Results.StatusCode(429);
            try
            {
                await sender.SendAsync(mapped, ctx.RequestAborted);
                if (identity.Generation != generation || !Connected(source, health) ||
                    !Trusted(identity, telemetry) ||
                    !gate.Armed(generation, title, DateTimeOffset.UtcNow))
                    return Results.Conflict(new { error = "V průběhu odesílání se změnilo spojení či letadlo. Výsledek je neznámý." });
                gate.Sent(input, generation, title!, DateTimeOffset.UtcNow,
                    readback.TimestampUtc);
                return Results.Accepted(value = new
                {
                    status = "sent_unverified",
                    command = input.Command,
                    requestedValue = input.Value,
                    confirmation = "pending_simvar_observation",
                    note = "Povel byl předán SimConnectu, nikoli potvrzen na FCU Airbusu."
                });
            }
            catch (OperationCanceledException) when (ctx.RequestAborted.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch (Exception ex) when (ex is SEHException or System.Runtime.InteropServices.COMException
                or IOException or DllNotFoundException or PlatformNotSupportedException)
            {
                app.Logger.LogWarning(ex, "A320 reference key event failed.");
                return Results.Problem("SimConnect odmítl FCU Key Event.", statusCode: 503);
            }
        });
    }
}
