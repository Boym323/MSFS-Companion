using System.Text.RegularExpressions;

namespace MsfsCompanion.Bridge.Aircraft;

public sealed record AircraftProfile(
    string Id, string Label, string Avionics, string[] CandidatePanels,
    bool Verified, string Note);

/// <summary>
/// Rozpoznání podle TITLE je jen heuristika, nikoli důkaz dostupnosti Input Events.
/// Řazení pravidel je důležité: konkrétní varianty před obecnými.
/// </summary>
public static class AircraftProfileResolver
{
    private static readonly (string Pattern, AircraftProfile Profile)[] Rules =
    [
        // TITLE alone is never proof of a verified avionics integration.
        // Named third-party variants must never inherit other aircraft's commands.
        (@"(a32nx|flybywire.{0,40}a320(?:neo)?|a320.{0,20}flybywire)",
            new("a320-fbw-a32nx-candidate", "FlyByWire A32NX (kandidát)",
                "Oficiální MCDU přes SimBridge", ["pfd", "map", "radio", "airliner"],
                false, "Ověřit skutečný A32NX a SimBridge v MSFS.")),
        (@"(inibuilds?.{0,40}a320(?:neo)?|a320(?:neo)?.{0,35}inibuilds?)",
            new("a320-inibuilds-v2-candidate", "iniBuilds A320neo V2 (kandidát)",
                "FMS/MCDU bez potvrzeného externího rozhraní", ["pfd", "map", "radio", "airliner"],
                false, "Dokud nejsou ověřena V2 rozhraní, žádné MCDU povely z Companion.")),
        (@"(flybywire|fenix|inibuilds|inibuild)", new("airbus-addon",
            "Airbus – jiná avionika", "Add-on FCU/MCDU (neověřeno)",
            ["pfd", "map", "radio", "airliner"], false,
            "Tento doplněk zatím nemá ověřené rozhraní FMS/MCDU.")),
        (@"(a320[ -]?neo|a320neo|a320)", new("a320-unsupported",
            "Airbus A320 bez ověřeného adaptéru", "Společné SimConnect údaje",
            ["pfd", "map", "radio", "airliner"], false,
            "V1/WASM byl odstraněn; bez přesného TITLE žádná specializovaná ovládací API.")),
        (@"(airbus)", new("airbus", "Airbus – neověřeno", "Airliner FMC/FCU",
            ["pfd", "map", "radio", "airliner"], false,
            "Generické AP povely blokovány, dokud nejsou ověřené pro variantu.")),
    ];

    public static bool IsAirbusLike(string? title) =>
        title is {Length: > 0 and <= 256} &&
        Regex.IsMatch(title,@"(airbus|a318|a319|a320|a321|a32nx|a330|a350|a380|flybywire|fenix|inibuilds?)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(50));

    public static AircraftProfile Resolve(string? title)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Length > 256)
            return Generic;
        foreach (var (pattern, profile) in Rules)
            if (Regex.IsMatch(title, pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
                TimeSpan.FromMilliseconds(50))) return profile;
        return Generic;
    }

    public static readonly AircraftProfile Generic = new("generic", "Obecné letadlo",
        "Neznámá avionika", ["pfd", "map", "radio"], false,
        "Ovládání avioniky se zpřístupní jen po přímém ověření v MSFS.");
}
