using MsfsCompanion.Bridge.Avionics;
namespace MsfsCompanion.Bridge.Integrations;

/// <summary>
/// Input-event enumeration proves visibility, not that a command changes an
/// aircraft system. Never mark a control as verified without readback.
/// </summary>
public static class CompatibilityAssessment
{
    public sealed record Result(string State, bool AircraftMatches, bool ScanFresh,
        bool CommandsConfirmed, int EnumeratedCount, int CandidateCount, string? Reason);

    public static Result Evaluate(bool connected, string? currentAircraft,
        G1000Availability g1000, G1000Availability advanced, int enumerated, int candidates,
        DateTimeOffset now)
    {
        if (!connected)
            return new("offline", false, false, false, 0, candidates, "SimConnect není připojen.");
        var namesMatch = !string.IsNullOrWhiteSpace(currentAircraft) &&
            string.Equals(currentAircraft, g1000.Aircraft, StringComparison.Ordinal) &&
            string.Equals(currentAircraft, advanced.Aircraft, StringComparison.Ordinal);
        var fresh = g1000.CheckedAt is { } scanned &&
            advanced.CheckedAt is { } other &&
            (now - scanned).TotalSeconds is >= -2 and <= 45 &&
            (now - other).TotalSeconds is >= -2 and <= 45;
        var error = advanced.Error ?? g1000.Error;
        var state = !namesMatch ? "aircraft_changed"
            : !fresh ? "scan_stale"
            : error is not null ? "scan_failed"
            : enumerated == 0 ? "no_input_events"
            : "enumerated";
        return new(state, namesMatch, fresh, false, enumerated, candidates,
            state == "enumerated" ? "Enumerováno v MSFS; odezva není ověřena zpětným čtením."
            : error ?? "Ovládací akce nelze považovat za ověřené.");
    }
}
