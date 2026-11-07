using MsfsCompanion.Bridge.Integrations;
using MsfsCompanion.Bridge.Aircraft;
static void Check(bool ok,string why){if(!ok)throw new Exception(why);}
var fbw=CompatibilityAssessment.Evaluate(true,"FlyByWire A32NX");
Check(fbw.State=="a32nx_candidate","A32NX candidate");
Check(fbw.IdentityTrusted&&!fbw.CommandsConfirmed&&!fbw.FmsVerified&&
    !fbw.InputEventsEnumerated,"No inferred FMS/control capabilities");
var v2=CompatibilityAssessment.Evaluate(true,"iniBuilds Airbus A320neo V2");
Check(v2.State=="inibuilds_v2_candidate","iniBuilds candidate");
Check(CompatibilityAssessment.Evaluate(true,"Cessna 172 G1000").State==
    "unsupported_aircraft","retired Garmin support");
Check(CompatibilityAssessment.Evaluate(true,"Fenix A320").State==
    "unsupported_aircraft","do not claim Fenix A320 support");
Check(!CompatibilityAssessment.Evaluate(false,"FlyByWire A32NX").IdentityTrusted,
    "stale identity blocked");
Check(AircraftProfileResolver.Resolve("Daher TBM930").Id=="generic",
    "retired profile generic fallback");
Check(FlyByWireIntegrationEndpoints.IsA32nxCandidate("FlyByWire A32NX"), "dedicated A32NX");
Check(!FlyByWireIntegrationEndpoints.IsA32nxCandidate("iniBuilds Airbus A320neo V2"), "iniBuilds is not FlyByWire");
Check(!FlyByWireIntegrationEndpoints.IsA32nxCandidate("Airbus A320 Neo"), "generic Airbus must not call SimBridge");
Check(FlyByWireIntegrationEndpoints.ParsePort(null)==8380 &&
    FlyByWireIntegrationEndpoints.ParsePort("8381")==8381 &&
    FlyByWireIntegrationEndpoints.ParsePort("0")==8380 &&
    FlyByWireIntegrationEndpoints.ParsePort("65536")==8380,
    "SimBridge port validation");
Console.WriteLine("PASS: read-only Airbus capabilities; no Garmin commands");
