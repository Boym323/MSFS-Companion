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
        (@"(nxcub)", new("nxcub", "CubCrafters NXCub", "G3X (kandidát)",
            ["pfd", "map", "radio", "g3x"], false, "Ověřit variantu NXCub.")),
        (@"(xcub|x.?cub)", new("xcub", "CubCrafters XCub", "G3X / podle varianty",
            ["pfd", "map", "radio", "g3x"], false, "Ověřit konkrétní avioniku a Input Events v MSFS 2020.")),
        (@"(c172|cessna 172|skyhawk)", new("c172", "Cessna 172", "G1000 / analog podle varianty",
            ["pfd", "map", "radio", "g1000"], false, "G1000 jen pokud je fyzicky přítomný a enumerovaný.")),
        (@"(tbm.?930)", new("tbm930", "Daher TBM 930", "G3000",
            ["pfd", "map", "radio", "g3000"], false, "Ověřit G3000 Input Events.")),
        (@"(da.?40|diamond 40)", new("da40", "Diamond DA40", "G1000 (kandidát)",
            ["pfd", "map", "radio", "g1000"], false, "Ověřit variantu avioniky.")),
        (@"(da.?62|diamond 62)", new("da62", "Diamond DA62", "G1000 (kandidát)",
            ["pfd", "map", "radio", "g1000"], false, "Ověřit variantu avioniky.")),
        // TITLE is a candidate, NOT proof of Asobo aircraft package identity.
        // Named third-party variants must never inherit Asobo-specific assumptions.
        (@"(a32nx|flybywire|fenix|inibuilds|inibuild)", new("airbus-addon",
            "Airbus – jiná avionika", "Add-on FCU/MCDU (neověřeno)",
            ["pfd", "map", "radio", "airliner"], false,
            "Nejedná se o potvrzený profil výchozí Asobo A320neo.")),
        (@"(a320[ -]?neo|a320neo|a320)", new("a320-asobo-candidate",
            "Airbus A320neo (Asobo kandidát)", "FCU/MCDU (read-only diagnostika)",
            ["pfd", "map", "radio", "airliner"], false,
            "Podoba TITLE nestačí k potvrzení Asobo V1; generické AP povely blokovány.")),
        (@"(airbus)", new("airbus", "Airbus – neověřeno", "Airliner FMC/FCU",
            ["pfd", "map", "radio", "airliner"], false,
            "Generické AP povely blokovány, dokud nejsou ověřené pro variantu.")),
        (@"(g36|bonanza)", new("g36", "Beechcraft Bonanza G36", "G1000 (kandidát)",
            ["pfd", "map", "radio", "g1000"], false, "Ověřit avioniku.")),
        (@"(c208|caravan)", new("c208", "Cessna 208", "G1000 (kandidát)",
            ["pfd", "map", "radio", "g1000"], false, "Ověřit avioniku.")),
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
