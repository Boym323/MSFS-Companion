namespace MsfsCompanion.Bridge.Telemetry;

public sealed record AutopilotModesSnapshot(DateTimeOffset TimestampUtc,
    bool Heading, bool Nav, bool Altitude, bool VerticalSpeed);

public sealed class AutopilotModesStore
{
    private AutopilotModesSnapshot? _current;
    public void Reset() => Interlocked.Exchange(ref _current, null);
    public void Update(SimConnectAutopilotModesData data, DateTimeOffset at) =>
        Interlocked.Exchange(ref _current, new AutopilotModesSnapshot(at,
            data.Heading > 0.5, data.Nav > 0.5, data.Altitude > 0.5, data.VerticalSpeed > 0.5));

    public object Status()
    {
        var state = Volatile.Read(ref _current);
        var age = state is null ? (double?)null : Math.Max(0, (DateTimeOffset.UtcNow - state.TimestampUtc).TotalMilliseconds);
        var connected = age is < 6000;
        return new { connected, sampleAgeMs = connected ? age : null, modes = connected ? state : null };
    }
}
