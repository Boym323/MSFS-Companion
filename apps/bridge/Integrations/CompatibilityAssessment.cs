using MsfsCompanion.Bridge.Aircraft;

namespace MsfsCompanion.Bridge.Integrations;

/// <summary>
/// Read-only aircraft identity diagnostics. Not an FMS integration and never
/// a source of permission to send any aircraft commands.
/// </summary>
public static class CompatibilityAssessment
{
    public sealed record Result(string State,bool IdentityTrusted,bool CommandsConfirmed,
        bool FmsVerified,bool InputEventsEnumerated,string Reason);

    public static Result Evaluate(bool trusted,string? aircraft)
    {
        if(!trusted||string.IsNullOrWhiteSpace(aircraft))
            return new("offline",false,false,false,false,
                "Není dostupný čerstvý SimConnect TITLE; povely zůstávají blokovány.");

        var profile=AircraftProfileResolver.Resolve(aircraft);
        var state=profile.Id switch
        {
            "a320-fbw-a32nx-candidate"=>"a32nx_candidate",
            "a320-inibuilds-v2-candidate"=>"inibuilds_v2_candidate",
            _=>"unsupported_aircraft"
        };
        var reason=state switch
        {
            "a32nx_candidate"=>"TITLE připomíná A32NX; externí MCDU a FMS nejsou potvrzeny.",
            "inibuilds_v2_candidate"=>"TITLE připomíná iniBuilds V2; přístup k FMS není ověřen.",
            _=>"Tento model nemá specializovanou integraci Companion."
        };
        return new(state,true,false,false,false,reason);
    }
}
