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
    string? LastError);

/// <summary>
/// Sdílený stav zdroje telemetrie. Zámek chrání proti souběhu vláken
/// SimConnect callbacku a HTTP požadavků; uchovává jen poslední stav.
/// </summary>
public sealed class TelemetryHealth
{
    private readonly object _gate = new();
    private string _state = "waiting";
    private DateTimeOffset? _lastSample;
    private DateTimeOffset? _previousSample;
    private double _rateHz;
    private long _samples;
    private int _attempts;
    private string? _lastError;

    public void StartConnecting()
    {
        lock (_gate)
        {
            _attempts++;
            _state = "connecting";
            _lastSample = null;
            _previousSample = null;
            _rateHz = 0;
        }
    }

    public void SetWaiting(string? error = null)
    {
        lock (_gate)
        {
            _state = "waiting";
            _lastSample = null;
            _previousSample = null;
            _rateHz = 0;
            if (!string.IsNullOrWhiteSpace(error))
                _lastError = error.Length <= 200 ? error : error[..200];
        }
    }

    public void AcceptSample(DateTimeOffset at)
    {
        lock (_gate)
        {
            if (_previousSample is { } previous)
            {
                var interval = (at - previous).TotalSeconds;
                if (interval > 0 && interval < 2)
                {
                    var instantaneous = Math.Min(100, 1 / interval);
                    _rateHz = _rateHz <= 0
                        ? instantaneous
                        : 0.85 * _rateHz + 0.15 * instantaneous;
                }
            }

            _state = "connected";
            _previousSample = at;
            _lastSample = at;
            _samples++;
            _lastError = null;
        }
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
                connected ? Math.Round(_rateHz, 1) : 0,
                _samples,
                _attempts,
                _lastError);
        }
    }
}
