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
Assert(G1000Catalog.TryResolve("pfd.fpl", 1, out var flightPlan)
    && flightPlan?.InputEvent == "AS1000_FPL_PFD");
Assert(G1000Catalog.TryResolve("mfd.proc", 1, out _));
Assert(!G1000Catalog.TryResolve("mfd.proc", -1, out _));
Assert(G1000Catalog.TryResolve("mfd.range", -1, out _));
Assert(!G1000Catalog.TryResolve("mfd.range", 5, out _));
Assert(G1000Catalog.All.Select(a => a.Id).Distinct().Count() == G1000Catalog.All.Length);
Assert(AdvancedAvionicsCatalog.TryResolve("g3x.left.outer", -1, out _));
Assert(AdvancedAvionicsCatalog.TryResolve("g3000.pfd.softkey.12", 1, out _));
Assert(AdvancedAvionicsCatalog.TryResolve("gns430.fpl", 1, out _));
Assert(AdvancedAvionicsCatalog.TryResolve("gns530.inner", 1, out _));
Assert(!AdvancedAvionicsCatalog.TryResolve("gns530.inner", 100, out _));
Assert(!AdvancedAvionicsCatalog.TryResolve("g3x.menu", -1, out _));
Assert(!AdvancedAvionicsCatalog.TryResolve("g3000.pfd.softkey.13", 1, out _));
Console.WriteLine("PASS: G1000 a C6 pokročilý allowlist.");
