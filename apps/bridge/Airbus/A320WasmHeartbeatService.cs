using System.Runtime.InteropServices;
using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Automatically sends ONLY the existing side-effect-free opcode 0 while the
/// original Asobo A320 is trusted. No arm permission, FCU reference, or
/// airplane control is needed to discover the in-sim module.
/// </summary>
public sealed class A320WasmHeartbeatService : BackgroundService
{
    public const int IntervalSeconds=15;
    private readonly A320WasmHeartbeatState _state;
    private readonly A320WasmEventSender _sender;
    private readonly AircraftIdentityGuard _identity;
    private readonly ITelemetrySource _source;
    private readonly TelemetryHealth _health;
    private readonly TelemetryStore _telemetry;
    private readonly ILogger<A320WasmHeartbeatService> _logger;

    public A320WasmHeartbeatService(A320WasmHeartbeatState state,
        A320WasmEventSender sender,AircraftIdentityGuard identity,
        ITelemetrySource source,TelemetryHealth health,TelemetryStore telemetry,
        ILogger<A320WasmHeartbeatService> logger)
    {
        _state=state;
        _sender=sender;
        _identity=identity;
        _source=source;
        _health=health;
        _telemetry=telemetry;
        _logger=logger;
    }

    private (bool SimLive,bool Trusted,long Generation,string? Title) Context()
    {
        var now=DateTimeOffset.UtcNow;
        var live=_source.Mode=="simconnect"&&
            _health.Snapshot(_source.Mode).Connected;
        var title=_identity.Current.Title;
        var trusted=live&&_identity.Trusted(_telemetry.Current.Aircraft,now)&&
            AircraftProfileResolver.Resolve(title).Id=="a320-asobo-candidate";
        return(live,trusted,_identity.Generation,title);
    }

    private (bool Trusted,long Generation,string? Title) Observe()
    {
        var current=Context();
        _state.Observe(current.SimLive,current.Trusted,
            current.Generation,current.Title);
        return(current.Trusted,current.Generation,current.Title);
    }

    public A320WasmHeartbeatState.Snapshot Status()
    {
        Observe(); // Also revokes old ACK instantly upon disconnection.
        return _state.Read(DateTimeOffset.UtcNow);
    }

    public bool Verified(long generation,string? title,DateTimeOffset now)
    {
        Observe();
        return _state.Verified(generation,title,now);
    }

    public async Task<A320WasmHeartbeatState.Snapshot> ProbeNowAsync(
        CancellationToken cancellationToken)
    {
        var context=Observe();
        if(!context.Trusted)return _state.Read(DateTimeOffset.UtcNow);
        var epoch=_state.Begin(DateTimeOffset.UtcNow);
        if(epoch is null)return _state.Read(DateTimeOffset.UtcNow);
        bool ok=false;
        string? error=null;
        try
        {
            ok=await _sender.ProbeAsync(cancellationToken);
            if(!ok)error=_sender.LastFailure??"ack_timeout";
        }
        catch(OperationCanceledException) when(cancellationToken.IsCancellationRequested)
        {
            error="cancelled";
            throw;
        }
        catch(Exception ex) when(ex is IOException or COMException or
            DllNotFoundException or EntryPointNotFoundException or
            PlatformNotSupportedException)
        {
            error=ex.GetType().Name;
            _logger.LogWarning(ex,"A320 WASM heartbeat could not complete.");
        }
        finally
        {
            // Reobserve BEFORE recording the ACK. A replay or slow probe
            // from an old simulator generation must NEVER make the new one ready.
            Observe();
            _state.Finish(epoch.Value,ok,ok?1u:null,error,
                DateTimeOffset.UtcNow);
        }
        return _state.Read(DateTimeOffset.UtcNow);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // When Windows/SimConnect is not running, Status remains WAITING;
        // no SimConnect handle is opened and no commands are sent.
        using var timer=new PeriodicTimer(TimeSpan.FromSeconds(IntervalSeconds));
        try
        {
            do
            {
                await ProbeNowAsync(stoppingToken);
            } while(await timer.WaitForNextTickAsync(stoppingToken));
        }
        catch(OperationCanceledException) when(stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown. No catch-up probes after restart.
        }
    }
}
