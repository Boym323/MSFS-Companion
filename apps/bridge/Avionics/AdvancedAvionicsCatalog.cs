namespace MsfsCompanion.Bridge.Avionics;

public sealed record AdvancedAvionicsAction(
    string Id, string Label, string EventName, string Family, bool Rotary);

/// <summary>Kandidátní názvy Input Events z MSFS Glass. Dostupnost určuje výhradně SimConnect.</summary>
public static class AdvancedAvionicsCatalog
{
    public static readonly AdvancedAvionicsAction[] All =
    [
        new("g3x.left.outer", "Levý vnější knob", "INSTRUMENT_AS3X_KNOB_OUTER_L", "g3x", true),
        new("g3x.left.inner", "Levý vnitřní knob", "INSTRUMENT_AS3X_KNOB_INNER_L", "g3x", true),
        new("g3x.right.outer", "Pravý vnější knob", "INSTRUMENT_AS3X_KNOB_OUTER_R", "g3x", true),
        new("g3x.right.inner", "Pravý vnitřní knob", "INSTRUMENT_AS3X_KNOB_INNER_R", "g3x", true),
        new("g3x.directto", "Direct-To", "INSTRUMENT_DIRECTTO", "g3x", false),
        new("g3x.nearest", "Nejbližší", "INSTRUMENT_NRST", "g3x", false),
        new("g3x.back", "Zpět", "INSTRUMENT_BACK", "g3x", false),
        new("g3x.menu", "Menu", "INSTRUMENT_MENU", "g3x", false),
        ..Enumerable.Range(1, 12).Select(n => new AdvancedAvionicsAction(
            $"g3000.pfd.softkey.{n}", $"PFD {n}", $"AS3000_PFD_1_SOFTKEY_{n}", "g3000", false)),
        ..Enumerable.Range(1, 12).Select(n => new AdvancedAvionicsAction(
            $"g3000.mfd.softkey.{n}", $"MFD {n}", $"AS3000_MFD_1_SOFTKEY_{n}", "g3000", false)),
        new("g3000.tsc.freq.mhz", "TSC frekvence MHz", "AS3000_TSC_1_FREQUENCY_KNOB_MHZ", "g3000", true),
        new("g3000.tsc.freq.khz", "TSC frekvence kHz", "AS3000_TSC_1_FREQUENCY_KNOB_KHZ", "g3000", true),
        new("g3000.tsc.swap", "TSC přepnout", "AS3000_TSC_1_FREQUENCY_SWAP", "g3000", false),
        new("gns530.directto", "Direct-To", "AS530_DIRECTTO", "gns530", false),
        new("gns530.menu", "Menu", "AS530_MENU", "gns530", false),
        new("gns530.ent", "Enter", "AS530_ENT", "gns530", false),
        new("gns530.fpl", "Flight Plan", "AS530_FPL", "gns530", false),
        new("gns530.outer", "Vnější knob", "AS530_GPS_OUTER", "gns530", true),
        new("gns530.inner", "Vnitřní knob", "AS530_GPS_INNER", "gns530", true)
    ];

    public static bool TryResolve(string? id, double? value, out AdvancedAvionicsAction? action)
    {
        action = All.FirstOrDefault(a => a.Id == id);
        if (action is null || value is null || !double.IsFinite(value.Value)) return false;
        return action.Rotary ? value is -1 or 1 : value == 1;
    }
}
