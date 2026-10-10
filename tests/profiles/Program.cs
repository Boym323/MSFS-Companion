using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Telemetry;
static void Check(bool x, string reason) { if (!x) throw new Exception(reason); }
Check(AircraftProfileResolver.Resolve("Cessna 172 Skyhawk G1000").Id == "c172", "c172");
Check(AircraftProfileResolver.Resolve("CubCrafters NXCub").Id == "nxcub", "specific before general");
Check(AircraftProfileResolver.Resolve("CubCrafters XCub Floats").Id == "xcub", "xcub");
Check(AircraftProfileResolver.Resolve("Daher TBM 930").Id == "tbm930", "tbm");
Check(AircraftProfileResolver.Resolve("Airbus A320 Neo").Id == "a320-asobo-candidate", "a320 candidate");
Check(AircraftProfileResolver.Resolve("Asobo Airbus A320neo").Id == "a320-asobo-candidate", "asobo candidate");
Check(AircraftProfileResolver.Resolve("FlyByWire A32NX").Id == "airbus-addon", "fbw separated");
Check(AircraftProfileResolver.Resolve("Fenix Airbus A320").Id == "airbus-addon", "fenix separated");
Check(AircraftProfileResolver.Resolve("iniBuilds Airbus A320neo").Id == "airbus-addon", "v2 separated");
// SimConnect.NET odmítá prázdnou jednotku v TITLE GetAsync/Subscribe.
Check(SimConnectTelemetrySource.AircraftTitleUnit == "string", "TITLE SimVar unit is nonempty string");
Check(AircraftProfileResolver.IsAirbusLike("A320neo"),"airbus identification");
Check(AircraftProfileResolver.IsAirbusLike("iniBuilds A321neo"),"A321 addon must be Airbus-protected");
Check(AircraftProfileResolver.IsAirbusLike("Airbus A350-900"),"other Airbus family AP policy");
Check(AircraftProfileResolver.Resolve("iniBuilds A321neo").Id=="airbus-addon","iniBuilds A321 addon profile");
Check(!AircraftProfileResolver.Resolve("Asobo Airbus A320neo").Verified,"unverified candidate");
var identity = new AircraftIdentityGuard();
var at = DateTimeOffset.UtcNow;
identity.Begin("Airbus A320neo",at);
Check(identity.Trusted("Airbus A320neo",at.AddSeconds(1)),"identity accepted");
identity.Observe("Cessna Skyhawk",at.AddSeconds(2));
Check(!identity.Trusted("Airbus A320neo",at.AddSeconds(3)),"aircraft change revokes trust");
identity.Observe("Airbus A320neo",at.AddSeconds(4));
Check(!identity.Trusted("Airbus A320neo",at.AddSeconds(4)),"no trust renewal after switch");
identity.Reset();
Check(!identity.Trusted("Airbus A320neo",at.AddSeconds(5)),"reset blocks control");
identity.Begin("Airbus A320neo",at);
Check(!identity.Trusted("Airbus A320neo",at.AddSeconds(11)),"stale identity cannot control");
// Regression: after 10s of missing TITLE callbacks, PFD must remain alive
// while command authorization expires. Only a real TITLE change reconnects.
Check(!identity.RequiresReconnect,"stale identity alone must not restart SimConnect");
identity.Observe("Airbus A320neo",at.AddSeconds(12));
Check(identity.Trusted("Airbus A320neo",at.AddSeconds(13)),
    "matching TITLE heartbeat restores trust");
identity.Observe("",at.AddSeconds(14));
Check(!identity.Trusted("Airbus A320neo",at.AddSeconds(14)),
    "blank TITLE immediately blocks controls");
Check(!identity.RequiresReconnect,"missing TITLE must not restart live PFD");
identity.Observe("Airbus A320neo",at.AddSeconds(15));
Check(identity.Trusted("Airbus A320neo",at.AddSeconds(15)),
    "matching TITLE recovers after transient blank sample");
identity.MarkUnavailable();
Check(!identity.Trusted("Airbus A320neo",at.AddSeconds(16)),
    "failed TITLE subscription must revoke controls");
identity.Observe("Cessna 172",at.AddSeconds(17));
Check(identity.RequiresReconnect,"genuine aircraft switch must reconnect");
identity.Reset();
identity.Begin(null,at);
Check(!identity.Trusted("Letadlo MSFS (SimConnect)",at.AddSeconds(1)),
    "display-only placeholder is never a trusted aircraft identity");
identity.Observe("Airbus A320neo",at.AddSeconds(2));
Check(!identity.RequiresReconnect && identity.Trusted("Airbus A320neo",at.AddSeconds(2)),
    "late initial TITLE must establish identity without a reconnect");
Check(AircraftProfileResolver.Resolve("RandomAircraft").Id == "generic", "fallback");
Check(!AircraftProfileResolver.Resolve("Cessna 172").Verified, "not verified");
Console.WriteLine("PASS: aircraft profiles and generic fallback.");