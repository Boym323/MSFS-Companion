using MsfsCompanion.Bridge.Integrations;
using MsfsCompanion.Bridge.Aircraft;
static void Assert(bool value) { if (!value) throw new Exception("C13 compatibility catalog"); }
var g1000 = CapabilityCatalog.ForAircraft("Cessna 172 G1000", ["pfd.fms.inner"]);
Assert(g1000.Any(x => x.Id == "pfd.fms.inner" && x.Enumerated));
Assert(g1000.Any(x => x.Id == "mfd.fms.inner" && !x.Enumerated));
Assert(!g1000.Any(x => x.Avionics == "g3000"));
var tbm = CapabilityCatalog.ForAircraft("Daher TBM 930", ["g3000.pfd.softkey.1"]);
Assert(tbm.Any(x => x.Enumerated && x.Avionics == "g3000"));
Assert(!tbm.Any(x => x.Avionics == "g1000"));
Assert(CapabilityCatalog.ForAircraft("Unknown", []).Length == 0);
Console.WriteLine("PASS: C13 per-aircraft allowlisted capabilities");
