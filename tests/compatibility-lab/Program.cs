using MsfsCompanion.Bridge.Integrations;
using MsfsCompanion.Bridge.Avionics;
static void Check(bool ok, string what) { if(!ok) throw new Exception(what); }
var now = DateTimeOffset.UtcNow;
var g = new G1000Availability("ready","Cessna 172",now,["pfd.ent"],null);
var a = new G1000Availability("ready","Cessna 172",now,["g3x.menu"],null);
var yes = CompatibilityAssessment.Evaluate(true,"Cessna 172",g,a,2,10,now);
Check(yes.State=="enumerated" && !yes.CommandsConfirmed && yes.ScanFresh,"Enumeration is NOT command confirmation");
Check(CompatibilityAssessment.Evaluate(true,"Other",g,a,2,10,now).State=="aircraft_changed","switch aircraft");
Check(CompatibilityAssessment.Evaluate(true,"Cessna 172",g,a with{CheckedAt=now.AddMinutes(-2)},2,10,now).State=="scan_stale","stale scan");
Check(CompatibilityAssessment.Evaluate(true,"Cessna 172",g,a,0,10,now).State=="no_input_events","nothing available");
Check(CompatibilityAssessment.Evaluate(false,null,g,a,2,10,now).State=="offline","disconnect");
Console.WriteLine("PASS: C22 no false command verification, stale scans, identity changes.");
