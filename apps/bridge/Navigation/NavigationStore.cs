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
    private NavigationSnapshot? _current;
    private string? _nextId;
    private DateTimeOffset _nameAt;

    public NavigationSnapshot? Current => Volatile.Read(ref _current);

    public void Reset()
    {
        Interlocked.Exchange(ref _current, null);
        Volatile.Write(ref _nextId, null);
        _nameAt = default;
    }

    public void UpdateName(string? name, DateTimeOffset at)
    {
        var normalized = string.IsNullOrWhiteSpace(name) ? null : name.Trim();
        if (normalized is not null && (normalized.Length > 32 ||
            normalized.Any(c => char.IsControl(c) || !(char.IsLetterOrDigit(c) || c is '-' or '_' or ' '))))
            normalized = null;
        _nameAt = at;
        Volatile.Write(ref _nextId, normalized);
    }

    public void Update(SimConnectNavigationData data, DateTimeOffset at)
    {
        if (!data.IsValid()) return;
        var next = data.WaypointActive > .5 ? Point(data.NextLatitude, data.NextLongitude) : null;
        var prev = next is not null && data.PreviousValid > .5
            ? Point(data.PreviousLatitude, data.PreviousLongitude) : null;
        Interlocked.Exchange(ref _current, new NavigationSnapshot(at,
            data.PlanActive > .5, next is not null,
            (int)Math.Clamp(Math.Truncate(data.WaypointCount), 0, 500),
            (int)Math.Clamp(Math.Truncate(data.WaypointIndex), 0, 500),
            null, next, prev,
            next is not null ? NonNegative(data.DistanceMeters / 1852) : null,
            next is not null ? NonNegative(data.EteSeconds) : null,
            next is not null ? Heading(data.DesiredTrackDegrees) : null,
            next is not null && Math.Abs(data.CrossTrackMeters) < 1_000_000
                ? data.CrossTrackMeters / 1852 : null,
            NonNegative(data.TotalDistanceMeters / 1852),
            Heading(data.GroundTrackDegrees)));
    }

    private static NavigationPoint? Point(double lat, double lon) =>
        double.IsFinite(lat) && double.IsFinite(lon) && Math.Abs(lat) <= 85.05
        && Math.Abs(lon) <= 180 && !(lat == 0 && lon == 0)
            ? new NavigationPoint(lat, lon) : null;

    private static double? NonNegative(double v) => double.IsFinite(v) && v >= 0 && v < 1_000_000 ? v : null;
    private static double? Heading(double degrees) =>
        double.IsFinite(degrees) ? (degrees % 360 + 360) % 360 : null;

    public object Status()
    {
        var snapshot = Current;
        var age = snapshot is null ? (double?)null
            : Math.Max(0, (DateTimeOffset.UtcNow - snapshot.TimestampUtc).TotalMilliseconds);
        var connected = age is < 6000;
        var nameRecent = snapshot is not null &&
            _nameAt >= snapshot.TimestampUtc.AddSeconds(-6);
        var result = connected && snapshot is not null ? snapshot with
        {
            NextWaypointId = snapshot.WaypointActive && nameRecent ? Volatile.Read(ref _nextId) : null
        } : null;
        return new { connected, sampleAgeMs = connected ? age : null, navigation = result };
    }
}
