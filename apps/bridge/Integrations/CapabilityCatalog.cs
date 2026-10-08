using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Avionics;

namespace MsfsCompanion.Bridge.Integrations;

/// <summary>
/// C13: vestavěný katalog existujících MSFS Input Events. HubHop presety
/// nepouštíme jako neověřený kód; ovladač je dostupný jen po enumeraci
/// aktuálního SimConnect klienta.
/// </summary>
public static class CapabilityCatalog
{
    public sealed record Entry(string Id, string Name, string Avionics,
        string InputEvent, bool Enumerated, bool Rotary);

    public static Entry[] ForAircraft(string? title, IEnumerable<string> availableIds)
    {
        var profile = AircraftProfileResolver.Resolve(title);
        var allowed = new HashSet<string>(availableIds, StringComparer.Ordinal);
        var candidate = profile.CandidatePanels;
        var source = AdvancedAvionicsCatalog.All
            .Where(a => candidate.Contains(a.Family, StringComparer.Ordinal))
            .Select(a => new Entry(a.Id, a.Label, a.Family, a.EventName,
                allowed.Contains(a.Id), a.Rotary));
        return source.Take(100).ToArray();
    }
}
