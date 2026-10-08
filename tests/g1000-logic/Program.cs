using MsfsCompanion.Bridge.Avionics;
static void Assert(bool condition) { if (!condition) throw new Exception("G1000 validation failed"); }
Assert(G1000Catalog.TryResolve("pfd.fms.inner", -1, out var inner)
    && inner?.InputEvent == "AS1000_FMS_LOWER_PFD");
Assert(G1000Catalog.TryResolve("mfd.heading", 1, out _));
Assert(G1000Catalog.TryResolve("pfd.directto", 1, out _));
Assert(!G1000Catalog.TryResolve("pfd.directto", -1, out _));
Assert(!G1000Catalog.TryResolve("pfd.fms.inner", 0, out _));
Assert(!G1000Catalog.TryResolve("pfd.fms.inner", 999, out _));
Assert(!G1000Catalog.TryResolve("unknown", 1, out _));
Assert(!G1000Catalog.TryResolve("pfd.heading", double.NaN, out _));
Assert(G1000Catalog.TryResolve("pfd.softkey.12", 1, out var softkey)
    && softkey?.AlternateInputEvent == "AS1000_SOFTKEYS_12_PFD");
Assert(!G1000Catalog.TryResolve("pfd.softkey.13", 1, out _));
Assert(!G1000Catalog.TryResolve("mfd.softkey.2", -1, out _));
Assert(G1000Catalog.All.Select(a => a.Id).Distinct().Count() == G1000Catalog.All.Length);
Console.WriteLine("PASS: G1000 allowlist, hodnoty, rozlišení ovladačů.");
