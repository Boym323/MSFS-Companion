namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Jednoslotová fronta: odběr SimConnect nikdy nečeká na HTTP ani vykreslování.
/// Čtenář dostane pouze novější snímek, každý nejvýše jednou.
/// </summary>
public sealed class LatestFrameBuffer<T> where T : struct
{
    public sealed record Frame(long Sequence, T Data, DateTimeOffset ReceivedUtc, long ReceivedTicks);

    private readonly object _writeGate = new();
    private Frame? _latest;
    private long _sequence;

    public void Write(T value, DateTimeOffset receivedUtc, long receivedTicks)
    {
        lock (_writeGate)
        {
            var next = new Frame(++_sequence, value, receivedUtc, receivedTicks);
            Volatile.Write(ref _latest, next);
        }
    }

    public bool TryReadNew(ref long lastSequence, out Frame? frame)
    {
        frame = Volatile.Read(ref _latest);
        if (frame is null || frame.Sequence <= lastSequence)
            return false;

        lastSequence = frame.Sequence;
        return true;
    }

    public long LastReceivedTicks => Volatile.Read(ref _latest)?.ReceivedTicks ?? 0;
}
