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
    private string? _code;
    private DateTimeOffset _codeAt;

    public void Reset()
    {
        Interlocked.Exchange(ref _current, null);
        Volatile.Write(ref _code, null);
    }

    public static string? DecodeTransponderCode(double value)
    {
        if (!double.IsFinite(value) || value < 0 || value > ushort.MaxValue || value != Math.Truncate(value))
            return null;
        var bcd = (ushort)value;
        var digits = new char[4];
        for (var i = 3; i >= 0; i--)
        {
            var d = bcd & 15;
            if (d > 7) return null;
            digits[i] = (char)('0' + d);
            bcd >>= 4;
        }
        return new string(digits);
    }

    public void UpdateTransponder(double code, DateTimeOffset at)
    {
        var decoded = DecodeTransponderCode(code);
        if (decoded is null) return;
        _codeAt = at;
        Volatile.Write(ref _code, decoded);
    }

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
            radios = connected ? current : null,
            transponderCode = connected && (DateTimeOffset.UtcNow - _codeAt).TotalSeconds < 6 ? Volatile.Read(ref _code) : null
        };
    }
}
