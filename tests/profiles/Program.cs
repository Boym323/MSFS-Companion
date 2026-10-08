using MsfsCompanion.Bridge.Aircraft;
static void Check(bool x, string reason) { if (!x) throw new Exception(reason); }
Check(AircraftProfileResolver.Resolve("Cessna 172 Skyhawk G1000").Id == "c172", "c172");
Check(AircraftProfileResolver.Resolve("CubCrafters NXCub").Id == "nxcub", "specific before general");
Check(AircraftProfileResolver.Resolve("CubCrafters XCub Floats").Id == "xcub", "xcub");
Check(AircraftProfileResolver.Resolve("Daher TBM 930").Id == "tbm930", "tbm");
Check(AircraftProfileResolver.Resolve("Airbus A320 Neo").Id == "airbus", "a320");
Check(AircraftProfileResolver.Resolve("RandomAircraft").Id == "generic", "fallback");
Check(!AircraftProfileResolver.Resolve("Cessna 172").Verified, "not verified");
Console.WriteLine("PASS: aircraft profiles and generic fallback.");