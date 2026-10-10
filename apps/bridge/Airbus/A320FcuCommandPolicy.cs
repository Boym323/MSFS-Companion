using MsfsCompanion.Bridge.Controls;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Exact allowlist of legacy MSFS 2020 Key Events for reference-setting
/// only. These DO NOT engage AP, switch managed/selected, or drive MCDU.
/// SimConnect may acknowledge transport without changing the A320 cockpit.
/// </summary>
public static class A320FcuCommandPolicy
{
    public sealed record Selection(string Command, double Value);
    public static readonly string[] Actions =
    [
        "a320.fcu.speed.set", "a320.fcu.mach.set",
        "a320.fcu.heading.set", "a320.fcu.altitude.set",
        "a320.fcu.vs.set"
    ];

    private static bool Integer(double value) =>
        double.IsFinite(value) && value == Math.Truncate(value);

    public static bool TryResolve(Selection? request, out MappedCockpitEvent? result)
    {
        result = null;
        if (request is null || !double.IsFinite(request.Value)) return false;
        var n = request.Value;
        switch (request.Command)
        {
            case "a320.fcu.speed.set" when Integer(n) && n is >= 100 and <= 350:
                result = new("AP_SPD_VAR_SET", (uint)n);
                return true;
            case "a320.fcu.mach.set" when n is >= 0.10 and <= 0.95:
            {
                var hundredths = Math.Round(n * 100, MidpointRounding.AwayFromZero);
                if (Math.Abs(hundredths / 100 - n) > 0.000001) return false;
                result = new("AP_MACH_VAR_SET", (uint)hundredths);
                return true;
            }
            case "a320.fcu.heading.set" when Integer(n) && n is >= 0 and <= 359:
                result = new("HEADING_BUG_SET", (uint)n);
                return true;
            case "a320.fcu.altitude.set" when Integer(n) && n is >= 100 and <= 49000
                                               && n % 100 == 0:
                result = new("AP_ALT_VAR_SET_ENGLISH", (uint)n);
                return true;
            case "a320.fcu.vs.set" when Integer(n) && n is >= -6000 and <= 6000
                                         && n % 100 == 0:
                result = new("AP_VS_VAR_SET_ENGLISH", unchecked((uint)(int)n));
                return true;
            default:
                return false;
        }
    }

    public static bool Matches(A320FcuSnapshot snapshot, Selection action) =>
        action.Command switch
        {
            "a320.fcu.speed.set" => Math.Abs(snapshot.SelectedSpeedKnots - action.Value) < 1.01,
            "a320.fcu.mach.set" => Math.Abs(snapshot.SelectedMach - action.Value) < 0.011,
            "a320.fcu.heading.set" =>
                Math.Abs(((snapshot.SelectedHeadingDegrees - action.Value + 540) % 360) - 180) < 1.01,
            "a320.fcu.altitude.set" => Math.Abs(snapshot.SelectedAltitudeFeet - action.Value) < 51,
            "a320.fcu.vs.set" => Math.Abs(snapshot.SelectedVerticalSpeedFpm - action.Value) < 51,
            _ => false
        };
}

/// <summary>
/// Per-bridge, per-aircraft-generation pilot opt-in. Explicitly revokes writes
/// on reconnect, aircraft switch, timeout, or operator disarm.
/// </summary>
public sealed class A320FcuControlGate
{
    private readonly object _gate = new();
    private long _generation;
    private string? _title;
    private DateTimeOffset _until;
    private Proof? _last;

    public sealed record Proof(string Command, double RequestedValue,
        DateTimeOffset SentAtUtc, DateTimeOffset BeforeSampleUtc,
        string Aircraft, long Generation);

    public bool Armed(long generation, string? title, DateTimeOffset now)
    {
        lock (_gate)
            return !string.IsNullOrWhiteSpace(title) &&
                _generation == generation &&
                string.Equals(_title, title, StringComparison.Ordinal) &&
                now < _until;
    }

    public void Arm(long generation, string title, DateTimeOffset now)
    {
        lock (_gate)
        {
            _generation = generation;
            _title = title;
            _until = now.AddMinutes(30);
            _last = null;
        }
    }

    public void Disarm()
    {
        lock (_gate) { _title = null; _until = default; _last = null; }
    }

    public void Sent(A320FcuCommandPolicy.Selection action,
        long generation, string title, DateTimeOffset now,
        DateTimeOffset previousSample)
    {
        lock (_gate)
        {
            if (_generation != generation || _title != title || now >= _until) return;
            _last = new Proof(action.Command, action.Value, now,
                previousSample, title, generation);
        }
    }

    public object Evidence(long generation, string? title, DateTimeOffset now,
        A320FcuSnapshot? fresh)
    {
        lock (_gate)
        {
            if (_last is not { } last || _generation != generation ||
                !string.Equals(_title, title, StringComparison.Ordinal) ||
                now >= _until)
                return new { state = "none", command = (string?)null,
                    value = (double?)null, sentAtUtc = (DateTimeOffset?)null };

            var state = now - last.SentAtUtc > TimeSpan.FromSeconds(7)
                ? "unconfirmed"
                : fresh is not null && fresh.TimestampUtc > last.BeforeSampleUtc &&
                  fresh.TimestampUtc > last.SentAtUtc &&
                  A320FcuCommandPolicy.Matches(fresh,
                    new A320FcuCommandPolicy.Selection(last.Command, last.RequestedValue))
                    ? "simvar_observed"
                    : "pending";

            // "simvar_observed" is NEVER authority that the physical Airbus FCU
            // or its managed / selected mode really changed.
            return new { state, command = last.Command,
                value = (double?)last.RequestedValue,
                sentAtUtc = (DateTimeOffset?)last.SentAtUtc };
        }
    }
}
