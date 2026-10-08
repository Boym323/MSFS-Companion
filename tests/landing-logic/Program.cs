using MsfsCompanion.Bridge.Telemetry;
static void Check(bool ok, string name) { if (!ok) throw new Exception(name); }
var landing = new LandingStore();
var now = DateTimeOffset.UtcNow;
Check(landing.Current is null, "initially empty");
landing.Update(new SimConnectLandingData {
    TouchdownNormalVelocityFeetPerSecond = 0, GForce = 1.0
}, now, false);
Check(landing.Current?.TouchdownAtUtc is null, "no touchdown airborne");
landing.Update(new SimConnectLandingData {
    TouchdownNormalVelocityFeetPerSecond = 2.5, GForce = 1.2
}, now.AddSeconds(1), true);
Check(landing.Current?.TouchdownRateFpm == -150, "correct ft/s to ft/min");
Check(landing.Current?.TouchdownAtUtc == now.AddSeconds(1), "touchdown timestamp");
landing.Update(new SimConnectLandingData {
    TouchdownNormalVelocityFeetPerSecond = 2.5, GForce = 1
}, now.AddSeconds(2), true);
Check(landing.Current?.TouchdownAtUtc == now.AddSeconds(1), "no repeated touchdown");
landing.Reset();
Check(landing.Current is null, "reset");
Console.WriteLine("PASS: C10 touchdown normal velocity and G force.");