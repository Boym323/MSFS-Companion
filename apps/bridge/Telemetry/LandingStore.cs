namespace MsfsCompanion.Bridge.Telemetry;

public sealed record LandingObservation(DateTimeOffset TimestampUtc,
    DateTimeOffset? TouchdownAtUtc, double? TouchdownRateFpm, double? GForce);

/// <summary>
/// SimConnect reported normal touchdown velocity, not an estimate from 1Hz VSI.
/// Contact detection is approximate at 1Hz; missing samples yield unknowns.
/// </summary>
public sealed class LandingStore
{
    private LandingObservation? _current;
    private bool? _previousGround;
    public LandingObservation? Current => Volatile.Read(ref _current);
    public void Reset()
    {
        Interlocked.Exchange(ref _current, null);
        _previousGround = null;
    }

    public void Update(SimConnectLandingData data, DateTimeOffset now, bool? onGround)
    {
        if (!data.IsValid()) return;
        var prior = Current;
        var touch = prior?.TouchdownAtUtc;
        var rate = prior?.TouchdownRateFpm;
        if (_previousGround == false && onGround == true)
        {
            // SimVar reports ft/s normal to ground; UI uses negative ft/min for downward touchdown.
            var value = Math.Abs(data.TouchdownNormalVelocityFeetPerSecond * 60);
            rate = value <= 6000 ? -value : null;
            touch = now;
        }
        if (onGround is not null) _previousGround = onGround;
        var g = data.GForce is >= -5 and <= 15 ? data.GForce : (double?)null;
        Interlocked.Exchange(ref _current, new LandingObservation(now, touch, rate, g));
    }

    public object Status()
    {
        var snap = Current;
        var connected = snap is not null
            && (DateTimeOffset.UtcNow - snap.TimestampUtc).TotalSeconds is >= -1 and < 6;
        return new { connected, landing = connected ? snap : null };
    }

    public LandingObservation? Fresh(DateTimeOffset now)
    {
        var value = Current;
        return value is not null && (now - value.TimestampUtc).TotalSeconds is >= -1 and < 3
            ? value : null;
    }
}
