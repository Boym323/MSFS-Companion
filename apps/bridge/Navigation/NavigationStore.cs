namespace MsfsCompanion.Bridge.Navigation;

public sealed record NavigationPoint(double Latitude, double Longitude);
public sealed record NavigationSnapshot(
    DateTimeOffset TimestampUtc, bool FlightPlanActive, bool WaypointActive,
    int WaypointCount, int WaypointIndex, string? NextWaypointId,
    NavigationPoint? NextWaypoint, NavigationPoint? PreviousWaypoint,
    double? DistanceNauticalMiles, double? EteSeconds, double? DesiredTrackDegrees,
    double? CrossTrackNauticalMiles, double? TotalFlightPlanNauticalMiles,
    double? GroundTrackDegrees);

public sealed class NavigationStore
{
    private readonly object _gate = new();
    private NavigationSnapshot? _current;
    private string? _nextId;
    private DateTimeOffset _nameAt;

    public NavigationSnapshot? Current => Volatile.Read(ref _current);

    public void Reset()
    {
        lock(_gate)
        {
            Interlocked.Exchange(ref _current,null);
            _nextId=null;
            _nameAt=default;
        }
    }

    public void UpdateName(string? name,DateTimeOffset at)
    {
        var normalized=string.IsNullOrWhiteSpace(name)?null:name.Trim();
        if(normalized is not null && (normalized.Length>32||
            normalized.Any(c=>char.IsControl(c)||
                !(char.IsLetterOrDigit(c)||c is '-' or '_' or ' '))))
            normalized=null;
        lock(_gate)
        {
            _nameAt=at;
            _nextId=normalized;
        }
    }

    public void Update(SimConnectNavigationData data,DateTimeOffset at)
    {
        if(!data.IsValid())return;
        var next=data.WaypointActive>.5?Point(data.NextLatitude,data.NextLongitude):null;
        var prev=next is not null&&data.PreviousValid>.5
            ?Point(data.PreviousLatitude,data.PreviousLongitude):null;
        var count=(int)Math.Clamp(Math.Truncate(data.WaypointCount),0,500);
        var index=(int)Math.Clamp(Math.Truncate(data.WaypointIndex),0,500);
        var active=data.PlanActive>.5;
        var snapshot=new NavigationSnapshot(at,active,next is not null,
            count,index,null,next,prev,
            next is not null?NonNegative(data.DistanceMeters/1852):null,
            next is not null?NonNegative(data.EteSeconds):null,
            next is not null?Heading(data.DesiredTrackDegrees):null,
            next is not null&&Math.Abs(data.CrossTrackMeters)<1_000_000
                ?data.CrossTrackMeters/1852:null,
            NonNegative(data.TotalDistanceMeters/1852),
            Heading(data.GroundTrackDegrees));
        lock(_gate)
        {
            var previous=_current;
            // GPS WP NEXT ID arrives from an independent 1Hz subscription.
            // It must never be carried onto a newly selected route leg.
            if(previous is not null &&
                (previous.FlightPlanActive!=active||
                 previous.WaypointCount!=count||previous.WaypointIndex!=index||
                 previous.WaypointActive!=(next is not null)||
                 !SamePoint(previous.NextWaypoint,next)))
            {
                _nameAt=default;
                _nextId=null;
            }
            Interlocked.Exchange(ref _current,snapshot);
        }
    }

    private static bool SamePoint(NavigationPoint? a,NavigationPoint? b)
    {
        if(a is null||b is null)return a is null&&b is null;
        // ~11 metres tolerance avoids resetting on harmless coordinate noise.
        return Math.Abs(a.Latitude-b.Latitude)<0.0001 &&
            Math.Abs(a.Longitude-b.Longitude)<0.0001;
    }

    private static NavigationPoint? Point(double lat,double lon) =>
        double.IsFinite(lat)&&double.IsFinite(lon)&&Math.Abs(lat)<=85.05
        &&Math.Abs(lon)<=180&&!(lat==0&&lon==0)
            ?new NavigationPoint(lat,lon):null;

    private static double? NonNegative(double v) =>
        double.IsFinite(v)&&v>=0&&v<1_000_000?v:null;
    private static double? Heading(double degrees) =>
        double.IsFinite(degrees)?(degrees%360+360)%360:null;

    public object Status()
    {
        lock(_gate)
        {
            var snapshot=_current;
            var age=snapshot is null?(double?)null:
                Math.Max(0,(DateTimeOffset.UtcNow-snapshot.TimestampUtc).TotalMilliseconds);
            var connected=age is <6000;
            var nameRecent=snapshot is not null&&
                _nameAt>=snapshot.TimestampUtc.AddSeconds(-6);
            var result=connected&&snapshot is not null?snapshot with {
                NextWaypointId=snapshot.WaypointActive&&nameRecent?_nextId:null
            }:null;
            return new {connected,sampleAgeMs=connected?age:null,navigation=result};
        }
    }
}
