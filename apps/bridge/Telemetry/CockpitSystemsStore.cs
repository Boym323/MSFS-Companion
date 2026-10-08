namespace MsfsCompanion.Bridge.Telemetry;

public sealed record CockpitSystemsSnapshot(DateTimeOffset TimestampUtc,
    bool Landing, bool Taxi, bool Nav, bool Beacon, bool Strobe, bool Pitot, bool ParkingBrake);

public sealed class CockpitSystemsStore
{
    private CockpitSystemsSnapshot? _current;
    public void Reset() => Interlocked.Exchange(ref _current, null);
    public void Update(SimConnectCockpitSystemsData value, DateTimeOffset at)
    {
        if (!value.IsValid()) return;
        Interlocked.Exchange(ref _current, new CockpitSystemsSnapshot(at,
            value.Landing > .5, value.Taxi > .5, value.Nav > .5,
            value.Beacon > .5, value.Strobe > .5, value.Pitot > .5,
            value.ParkingBrake > .5));
    }
    public object Status()
    {
        var state = Volatile.Read(ref _current);
        var age = state is null ? (double?)null
            : Math.Max(0, (DateTimeOffset.UtcNow - state.TimestampUtc).TotalMilliseconds);
        var connected = age is < 6000;
        return new { connected, sampleAgeMs = connected ? age : null, systems = connected ? state : null };
    }
}
