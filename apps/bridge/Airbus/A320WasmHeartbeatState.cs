namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Thread-safe proof of life scoped to exactly one trusted SimConnect
/// aircraft identity generation. A prior ACK is NEVER proof after a
/// disconnect, an identity lapse or simulator restart.
/// </summary>
public sealed class A320WasmHeartbeatState
{
    private readonly object _gate=new();
    private long _generation;
    private string? _aircraft;
    private string _context="waiting_sim";
    private long _epoch;
    private bool _checking;
    private DateTimeOffset? _lastAckUtc;
    private DateTimeOffset? _lastProbeUtc;
    private string? _error;
    private uint? _lastProtocolStatus;

    public sealed record Snapshot(
        string State,bool ModuleReady,DateTimeOffset? LastAckUtc,
        DateTimeOffset? LastProbeUtc,uint? LastProtocolStatus,
        string? LastError,long Generation);

    public void Observe(bool simLive,bool trusted,long generation,
        string? aircraft)
    {
        var context=!simLive?"waiting_sim":
            !trusted||string.IsNullOrWhiteSpace(aircraft)?
                "waiting_aircraft":"eligible";
        var name=context=="eligible"?aircraft:null;
        lock(_gate)
        {
            if(_context==context&&_generation==generation&&
                string.Equals(_aircraft,name,StringComparison.Ordinal))return;
            _epoch++; // In-flight probes cannot endorse the new context.
            _context=context;
            _generation=generation;
            _aircraft=name;
            _checking=false;
            _lastAckUtc=null;
            _lastProbeUtc=null;
            _lastProtocolStatus=null;
            _error=null;
        }
    }

    public long? Begin(DateTimeOffset now)
    {
        lock(_gate)
        {
            if(_context!="eligible"||_checking)return null;
            _checking=true;
            _lastProbeUtc=now;
            return _epoch;
        }
    }

    public void Finish(long epoch,bool success,uint? protocolStatus,
        string? failure,DateTimeOffset now)
    {
        lock(_gate)
        {
            if(epoch!=_epoch||_context!="eligible"||!_checking)return;
            _checking=false;
            _lastProtocolStatus=protocolStatus;
            if(success)
            {
                _lastAckUtc=now;
                _error=null;
            }
            else
            {
                // A failed probe immediately revokes a prior confirmation.
                _lastAckUtc=null;
                _error=string.IsNullOrEmpty(failure)?"ack_timeout":failure;
            }
        }
    }

    public Snapshot Read(DateTimeOffset now)
    {
        lock(_gate)
        {
            var confirmed=_context=="eligible"&&_lastAckUtc is { } at&&
                now>=at && now-at<TimeSpan.FromSeconds(45);
            var state=_context!="eligible"?_context:
                confirmed?"connected":_checking?"checking":
                _error is not null?(_error=="ack_timeout"?"unavailable":"error"):
                "checking";
            return new Snapshot(state,confirmed,_lastAckUtc,_lastProbeUtc,
                _lastProtocolStatus,_error,_generation);
        }
    }

    public bool Verified(long generation,string? aircraft,DateTimeOffset now)
    {
        lock(_gate)
        {
            return _context=="eligible"&&_generation==generation&&
                string.Equals(_aircraft,aircraft,StringComparison.Ordinal)&&
                _lastAckUtc is { } at&&now>=at&&
                now-at<TimeSpan.FromSeconds(45);
        }
    }
}
