namespace MsfsCompanion.Bridge.Telemetry;

public sealed record RadioSnapshot(DateTimeOffset TimestampUtc,
    double Com1ActiveMHz, double Com1StandbyMHz,
    double Com2ActiveMHz, double Com2StandbyMHz,
    double Nav1ActiveMHz, double Nav1StandbyMHz,
    double Nav2ActiveMHz, double Nav2StandbyMHz);

/// <summary>
/// Čerstvý readback, nikoli optimisticky potvrzený výsledek povelu.
/// Frekvence mohou být pro konkrétní letadlo nedostupné či nulové.
/// </summary>
public sealed class RadioStore
{
    private RadioSnapshot? _current;

    public void Reset() => Interlocked.Exchange(ref _current, null);

    public void Update(SimConnectRadioData data, DateTimeOffset at) =>
        Interlocked.Exchange(ref _current, new RadioSnapshot(at,
            data.Com1ActiveMHz, data.Com1StandbyMHz,
            data.Com2ActiveMHz, data.Com2StandbyMHz,
            data.Nav1ActiveMHz, data.Nav1StandbyMHz,
            data.Nav2ActiveMHz, data.Nav2StandbyMHz));

    public object Status()
    {
        var current = Volatile.Read(ref _current);
        var age = current is null ? (double?)null
            : Math.Max(0, (DateTimeOffset.UtcNow - current.TimestampUtc).TotalMilliseconds);
        var connected = age is < 6000;
        return new
        {
            connected,
            sampleAgeMs = connected ? age : null,
            radios = connected ? current : null
        };
    }
}
