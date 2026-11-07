using MsfsCompanion.Bridge.Integrations;
static void Check(bool ok,string why){if(!ok)throw new Exception(why);}
Check(CompatibilityAssessment.Evaluate(false,null).State=="offline","offline");
Check(CompatibilityAssessment.Evaluate(false,"FlyByWire A32NX").State=="offline",
    "stale TITLE never leaks as current");
Check(CompatibilityAssessment.Evaluate(true,"Airbus A320 Neo").State==
    "unsupported_aircraft","retired Asobo V1 not advertised");
Check(CompatibilityAssessment.Evaluate(true,"FlyByWire A380X").State==
    "unsupported_aircraft","A380 never treated as A32NX");
Check(CompatibilityAssessment.Evaluate(true,"iniBuilds A321neo").State==
    "unsupported_aircraft","iniBuilds A321 not V2 A320");
var status=CompatibilityAssessment.Evaluate(true,"iniBuilds A320neo V2");
Check(status.IdentityTrusted&&!status.CommandsConfirmed&&!status.FmsVerified&&
    !status.InputEventsEnumerated,"TITLE does not verify FMS or commands");
Console.WriteLine("PASS: Airbus candidate identities remain read-only and fail closed");
