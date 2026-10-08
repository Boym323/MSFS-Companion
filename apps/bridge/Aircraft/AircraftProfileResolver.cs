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
        (@"(a320|airbus)", new("airbus", "Airbus", "Airliner FMC/FCU",
            ["pfd", "map", "radio", "airliner"], false, "Standardní AP Eventy nemusí ovládat addony.")),
        (@"(g36|bonanza)", new("g36", "Beechcraft Bonanza G36", "G1000 (kandidát)",
            ["pfd", "map", "radio", "g1000"], false, "Ověřit avioniku.")),
        (@"(c208|caravan)", new("c208", "Cessna 208", "G1000 (kandidát)",
            ["pfd", "map", "radio", "g1000"], false, "Ověřit avioniku.")),
    ];

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
