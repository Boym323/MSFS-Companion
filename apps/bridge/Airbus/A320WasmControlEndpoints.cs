using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Controls;
using MsfsCompanion.Bridge.Telemetry;
using System.Runtime.InteropServices;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Strictly isolated Asobo A320-specific in-sim H-event transport.
/// The simulator MUST contain Kokpit's optional WASM package; no web caller
/// can supply a simulator script, Key Event name, or raw opcode.
/// </summary>
public static class A320WasmControlEndpoints
{
    public sealed record HEventRequest(string Command);

    public static void MapA320WasmControls(this WebApplication app)
    {
        static bool Live(ITelemetrySource source,TelemetryHealth health) =>
            source.Mode=="simconnect" && health.Snapshot(source.Mode).Connected;

        static bool Trusted(AircraftIdentityGuard identity,TelemetryStore telemetry) =>
            identity.Trusted(telemetry.Current.Aircraft,DateTimeOffset.UtcNow) &&
            AircraftProfileResolver.Resolve(identity.Current.Title).Id=="a320-asobo-candidate";

        app.MapGet("/api/a320/wasm/status",(HttpContext ctx,A320WasmEventSender sender,
            A320FcuControlGate gate,AircraftIdentityGuard identity,
            ITelemetrySource source,TelemetryHealth health,
            TelemetryStore telemetry,A320ReadbackStore readbacks)=>
        {
            ctx.Response.Headers.CacheControl="no-store";
            var now=DateTimeOffset.UtcNow;
            var trusted=Live(source,health)&&Trusted(identity,telemetry);
            var armed=trusted&&gate.Armed(identity.Generation,identity.Current.Title,now);
            var fresh=trusted&&readbacks.FreshFcu(now) is not null;
            var module=sender.RecentlyAvailable;
            return Results.Ok(new {
                moduleReady=module,ready=module&&armed&&fresh,
                armed,fcuFresh=fresh,local=ControlAccess.IsLoopback(ctx),
                actions=A320WasmProtocol.AvailableActions,
                moduleProtocolVersion=A320WasmProtocol.Version,
                lastError=sender.LastFailure,
                note="WASM ack znamená přijetí konkrétní H události, nikoli potvrzený managed/selected nebo stav FCU/FMA."
            });
        });

        app.MapPost("/api/a320/wasm/probe",async(HttpContext ctx,
            A320WasmEventSender sender,ITelemetrySource source,
            TelemetryHealth health)=>
        {
            ctx.Response.Headers.CacheControl="no-store";
            // A deliberate diagnostic action on the simulator PC only.
            if(!ControlAccess.IsLoopback(ctx) || !ControlAccess.SameOrigin(ctx) ||
               ctx.Request.Headers["X-MSFS-Companion-Action"]!="a320-wasm-probe")
                return Results.StatusCode(403);
            if(!Live(source,health))
                return Results.Conflict(new {error="MSFS 2020 není živě připojen."});
            var ready=await sender.ProbeAsync(ctx.RequestAborted);
            return Results.Ok(new {moduleReady=ready,
                note=ready?"Kokpit WASM module odpověděl na bezpečný ping.":
                    "Modul není načtený nebo nereaguje. Zkontrolujte instalaci modulu do Community."});
        });

        app.MapPost("/api/a320/wasm/command",async(HttpContext ctx,
            HEventRequest input,A320WasmEventSender sender,
            ControlAccess access,A320FcuControlGate gate,
            AircraftIdentityGuard identity,ITelemetrySource source,
            TelemetryHealth health,TelemetryStore telemetry,
            A320ReadbackStore readbacks)=>
        {
            ctx.Response.Headers.CacheControl="no-store";
            if(!ControlAccess.SameOrigin(ctx))return Results.StatusCode(403);
            var token=ctx.Request.Headers["X-MSFS-Control-Token"].ToString();
            if(!access.CanControl(token))return Results.Unauthorized();
            if(!A320WasmProtocol.TryResolve(input.Command,out var operation))
                return Results.BadRequest(new {error="Neznámá Airbus H-událost."});
            var now=DateTimeOffset.UtcNow;
            if(!Live(source,health)||!Trusted(identity,telemetry))
                return Results.Conflict(new {error="Neověřené letadlo nebo SimConnect."});
            var generation=identity.Generation;
            var title=identity.Current.Title;
            if(readbacks.FreshFcu(now) is null ||
               !gate.Armed(generation,title,now))
                return Results.Conflict(new {error="FCU reference nejsou čerstvé nebo testovací ovládání není aktivováno na Windows."});
            if(!sender.RecentlyAvailable)
                return Results.Conflict(new {error="H-Event modul není ověřen. Nejprve na Windows proveďte test spojení s WASM."});
            if(!access.PermitCommand(token))return Results.StatusCode(429);
            try
            {
                // The in-sim module accepts only fixed operation IDs.
                var result=await sender.SendAsync(operation,ctx.RequestAborted);
                if(identity.Generation!=generation||!Live(source,health)||
                   !Trusted(identity,telemetry)||
                   !gate.Armed(generation,title,DateTimeOffset.UtcNow))
                    return Results.Conflict(new {
                        error="Letadlo nebo připojení se během odesílání změnilo; výsledek je neznámý."});
                return result==1
                    ? Results.Accepted(value:new {
                        status="module_ack_unverified_aircraft",command=input.Command,
                        note="WASM modul přijal pevně povolenou H-událost. Pro potvrzení změny FCU je nutné ověření v MSFS."})
                    : Results.Problem(statusCode:503,
                        detail:result==2?"WASM nedokázal provést událost.":"WASM odmítl nepodporovaný kód.");
            }
            catch(OperationCanceledException) when(ctx.RequestAborted.IsCancellationRequested)
            {
                return Results.StatusCode(499);
            }
            catch(Exception ex) when(ex is IOException or COMException or DllNotFoundException
                or EntryPointNotFoundException or PlatformNotSupportedException)
            {
                app.Logger.LogWarning(ex,"A320 WASM command unavailable.");
                return Results.Problem(statusCode:503,
                    detail:"MSFS 2020 H-Event modul neodpověděl. Žádné opakované příkazy neposíláme.");
            }
        });
    }
}
