using System.Buffers.Binary;

namespace MsfsCompanion.Bridge.Traffic;

public sealed record SimTrafficTarget(uint ObjectId, double Latitude, double Longitude,
    double AltitudeFeet, double HeadingDegrees, double GroundSpeedKnots, bool OnGround);
public sealed record SimTrafficPacket(uint RequestId, uint EntryNumber, uint OutOf,
    SimTrafficTarget Target);

/// <summary>
/// SimConnect SDK SIMCONNECT_RECV_SIMOBJECT_DATA_BYTYPE header = 40 bytes,
/// followed by six Float64 values in data-definition order.
/// Parses copied bytes; never retains raw native pointers.
/// </summary>
public static class TrafficPacketDecoder
{
    public const int ExpectedBytes = 40 + 6 * 8;
    public static bool TryDecode(ReadOnlySpan<byte> bytes, uint expectedRequestId,
        out SimTrafficPacket? packet)
    {
        packet = null;
        if(bytes.Length < ExpectedBytes) return false;
        uint size=BinaryPrimitives.ReadUInt32LittleEndian(bytes);
        uint recvType=BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(8));
        uint request=BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(12));
        uint objectId=BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(16));
        uint entry=BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(28));
        uint outOf=BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(32));
        uint count=BinaryPrimitives.ReadUInt32LittleEndian(bytes.Slice(36));
        if(size<ExpectedBytes||size>bytes.Length||recvType!=9||request!=expectedRequestId||
           objectId==0||outOf is 0 or > 5000||entry>=outOf||count<6)return false;
        double ReadDouble(int i)=>BitConverter.Int64BitsToDouble(
            BinaryPrimitives.ReadInt64LittleEndian(bytes.Slice(40+i*8)));
        var lat=ReadDouble(0);var lon=ReadDouble(1);var alt=ReadDouble(2);
        var heading=ReadDouble(3);var speed=ReadDouble(4);var ground=ReadDouble(5);
        if(!double.IsFinite(lat)||!double.IsFinite(lon)||Math.Abs(lat)>85.05||
           Math.Abs(lon)>180||!double.IsFinite(alt)||alt is < -3000 or > 70000||
           !double.IsFinite(heading)||!double.IsFinite(speed)||speed is < 0 or > 2000||
           !double.IsFinite(ground))return false;
        packet = new(request,entry,outOf,new SimTrafficTarget(objectId,lat,lon,
            alt,(heading%360+360)%360,speed,ground>0.5));
        return true;
    }
}

/// <summary>
/// A batch is only published once SimConnect sends its final object.
/// Missing responses are UNKNOWN, never a made-up empty traffic list.
/// </summary>
public sealed class SimTrafficState
{
    private readonly object _gate=new();
    private uint _requestId;
    private readonly Dictionary<uint,SimTrafficTarget> _pending=new();
    private SimTrafficTarget[] _current=[];
    private DateTimeOffset? _publishedAt;
    private DateTimeOffset _requestedAt=DateTimeOffset.MinValue;
    private string _status="not_requested";

    public void Touch() {lock(_gate)_requestedAt=DateTimeOffset.UtcNow;}
    public bool Wanted {get{lock(_gate)return DateTimeOffset.UtcNow-_requestedAt<TimeSpan.FromSeconds(35);}}
    public void Begin(uint requestId){lock(_gate){_requestId=requestId;_pending.Clear();_status="waiting_for_simconnect";}}
    public void Accept(SimTrafficPacket packet,DateTimeOffset receivedAt)
    {
        lock(_gate)
        {
            if(packet.RequestId!=_requestId)return;
            if(_pending.Count<100)_pending[packet.Target.ObjectId]=packet.Target;
            if(packet.EntryNumber+1>=packet.OutOf)
            {
                _current=_pending.Values.ToArray();
                _publishedAt=receivedAt;
                _status="confirmed";
                _pending.Clear();
            }
        }
    }
    public void Reset()
    {
        lock(_gate){
            _current=[];_publishedAt=null;_pending.Clear();_requestId=0;
            _status="not_requested";
        }
    }
    public void Error(){lock(_gate)_status="unavailable";}
    public object Snapshot(DateTimeOffset now)
    {
        lock(_gate)
        {
            var recent=_publishedAt is { } t && now-t<TimeSpan.FromSeconds(25);
            return new {available=recent,stale=!recent&&_publishedAt is not null,
                updatedAt=_publishedAt,status=recent?"confirmed":_status,
                source="MSFS SimConnect SimObjectType (not VATSIM)",
                targets=recent?_current:Array.Empty<SimTrafficTarget>()};
        }
    }
}
