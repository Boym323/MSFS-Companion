namespace MsfsCompanion.Bridge.Telemetry;

public sealed record TelemetryDiagnostics(
    string Mode,
    string ConnectionState,
    bool Connected,
    DateTimeOffset? LastTelemetryUtc,
    double? SampleAgeMs,
    double SampleRateHz,
    long SamplesReceived,
    int ConnectionAttempts,
    string? LastError,
    double IncomingRateHz,
    long SamplesPublished,
    long FramesSkipped,
    double? PublicationLagMs);

/// <summary>
/// Odděleně měří příjem ze simulátoru a publikované nové vzorky.
/// Bez nových vzorků nezvyšuje počitadla ani nenafukuje publikovanou frekvenci.
/// </summary>
public sealed class TelemetryHealth
{
    private readonly object _gate = new();
    private string _state = "waiting";
    private DateTimeOffset? _lastSample;
    private DateTimeOffset? _previousIncoming;
    private DateTimeOffset? _previousPublished;
    private double _publishedRateHz;
    private double _incomingRateHz;
    private double? _publicationLagMs;
    private long _received;
    private long _published;
    private long _skipped;
    private int _attempts;
    private string? _lastError;

    public void StartConnecting()
    {
        lock (_gate)
        {
            _attempts++;
            _state = "connecting";
            _lastSample = null;
            _previousIncoming = null;
            _previousPublished = null;
            _publishedRateHz = 0;
            _incomingRateHz = 0;
            _publicationLagMs = null;
        }
    }

    public void SetWaiting(string? error = null)
    {
        lock (_gate)
        {
            _state = "waiting";
            _lastSample = null;
            _previousIncoming = null;
            _previousPublished = null;
            _publishedRateHz = 0;
            _incomingRateHz = 0;
            _publicationLagMs = null;
            if (!string.IsNullOrWhiteSpace(error))
                _lastError = error.Length <= 200 ? error : error[..200];
        }
    }

    public void RecordIncoming(DateTimeOffset receivedUtc)
    {
        lock (_gate)
        {
            _incomingRateHz = NextRate(_incomingRateHz, _previousIncoming, receivedUtc);
            _previousIncoming = receivedUtc;
            _received++;
        }
    }

    public void RecordPublished(DateTimeOffset receivedUtc, DateTimeOffset publishedUtc, long skippedFrames)
    {
        lock (_gate)
        {
            _publishedRateHz = NextRate(_publishedRateHz, _previousPublished, publishedUtc);
            _previousPublished = publishedUtc;
            _lastSample = receivedUtc; // čas skutečného přijetí, nikoliv odeslání do webu
            _publicationLagMs = Math.Max(0, (publishedUtc - receivedUtc).TotalMilliseconds);
            _published++;
            _skipped += Math.Max(0, skippedFrames);
            _state = "connected";
            _lastError = null;
        }
    }

    // Kompatibilita s vývojovým mockem: každý generovaný snímek se předá ihned.
    public void AcceptSample(DateTimeOffset at)
    {
        RecordIncoming(at);
        RecordPublished(at, at, 0);
    }

    private static double NextRate(double current, DateTimeOffset? previous, DateTimeOffset at)
    {
        if (previous is not { } last)
            return current;

        var seconds = (at - last).TotalSeconds;
        if (seconds <= 0 || seconds >= 2)
            return current;

        var instantaneous = Math.Min(100, 1 / seconds);
        return current <= 0 ? instantaneous : 0.85 * current + 0.15 * instantaneous;
    }

    public TelemetryDiagnostics Snapshot(string mode)
    {
        lock (_gate)
        {
            var age = _lastSample is { } last
                ? Math.Max(0, (DateTimeOffset.UtcNow - last).TotalMilliseconds)
                : (double?)null;
            var connected = _state == "connected" && age is < 5000;
            return new(
                mode,
                connected ? "connected" : _state == "connected" ? "stale" : _state,
                connected,
                _lastSample,
                age,
                connected ? Math.Round(_publishedRateHz, 1) : 0,
                _received,
                _attempts,
                _lastError,
                connected ? Math.Round(_incomingRateHz, 1) : 0,
                _published,
                _skipped,
                connected ? Math.Round(_publicationLagMs ?? 0, 1) : null);
        }
    }
}
