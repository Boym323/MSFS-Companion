namespace MsfsCompanion.Bridge.Avionics;

public sealed record G1000Action(string Id, string Label, string InputEvent, bool Rotary);

/// <summary>
/// Kandidátní oficiální Input Events; dostupnost se VŽDY ověřuje enumerací
/// z právě načteného letadla. Nic není hardcoded jako "podporované".
/// </summary>
public static class G1000Catalog
{
    public static readonly G1000Action[] All =
    [
        new("pfd.fms.inner", "PFD FMS malý", "AS1000_FMS_LOWER_PFD", true),
        new("pfd.fms.outer", "PFD FMS velký", "AS1000_FMS_UPPER_PFD", true),
        new("mfd.fms.inner", "MFD FMS malý", "AS1000_FMS_LOWER_MFD", true),
        new("mfd.fms.outer", "MFD FMS velký", "AS1000_FMS_UPPER_MFD", true),
        new("pfd.heading", "PFD Heading", "AS1000_HEADING_PFD", true),
        new("mfd.heading", "MFD Heading", "AS1000_HEADING_MFD", true),
        new("pfd.nav.inner", "PFD NAV malý", "AS1000_NAV_SMALL_PFD", true),
        new("pfd.nav.outer", "PFD NAV velký", "AS1000_NAV_LARGE_PFD", true),
        new("mfd.nav.inner", "MFD NAV malý", "AS1000_NAV_SMALL_MFD", true),
        new("mfd.nav.outer", "MFD NAV velký", "AS1000_NAV_LARGE_MFD", true),
        // Následující názvy jsou kandidáti pro různé avionické profily.
        // API je aktivuje pouze pokud je simulator skutečně enumeruje.
        new("pfd.directto", "PFD Direct-To", "AS1000_DIRECTTO_PFD", false),
        new("mfd.directto", "MFD Direct-To", "AS1000_DIRECTTO_MFD", false),
        new("pfd.menu", "PFD Menu", "AS1000_MENU_PFD", false),
        new("mfd.menu", "MFD Menu", "AS1000_MENU_MFD", false),
        new("pfd.clr", "PFD Clear", "AS1000_CLR_PFD", false),
        new("mfd.clr", "MFD Clear", "AS1000_CLR_MFD", false),
    ];

    public static bool TryResolve(string? id, double? value, out G1000Action? action)
    {
        action = All.FirstOrDefault(item => item.Id == id);
        if (action is null || value is null || !double.IsFinite(value.Value))
            return false;
        // Rotary: směr +-1; tlačítko: impuls 1; bez libovolného payloadu.
        return action.Rotary ? value is 1 or -1 : value == 1;
    }
}
