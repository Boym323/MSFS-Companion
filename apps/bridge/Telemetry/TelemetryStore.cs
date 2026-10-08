namespace MsfsCompanion.Bridge.Telemetry;

public sealed class TelemetryStore
{
    private TelemetrySnapshot _current = new(
        DateTimeOffset.UtcNow,
        "Waiting for telemetry",
        0, 0, 0, 0, 0, 0, 0, 0);

    public TelemetrySnapshot Current => Volatile.Read(ref _current);

    public void Update(TelemetrySnapshot snapshot)
    {
        Interlocked.Exchange(ref _current, snapshot);
    }

    public void Reset(string message)
    {
        Interlocked.Exchange(ref _current, new TelemetrySnapshot(
            DateTimeOffset.UtcNow, message, 0, 0, 0, 0, 0, 0, 0, 0));
    }
}
