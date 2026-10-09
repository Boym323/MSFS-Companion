using MsfsCompanion.Bridge.Controls;
using MsfsCompanion.Bridge.Telemetry;

static void Must(bool ok, string name)
{
    if (!ok) throw new Exception("FAIL: " + name);
}
static MappedCockpitEvent Resolve(string command, double? value = null)
{
    if (!CockpitCommands.TryResolve(new ControlCommand(command, value), out var result) || result is null)
        throw new Exception("Command unexpectedly invalid: " + command);
    return result;
}
static void Reject(string command, double? value = null)
{
    Must(!CockpitCommands.TryResolve(new ControlCommand(command, value), out _), "reject " + command);
}

Must(Resolve("radio.com1.set", 118_500_000).Name == "COM_STBY_RADIO_SET_HZ", "COM1 event");
Must(Resolve("radio.com2.set", 121_500_000).Data == 121_500_000, "COM2 Hz");
Must(Resolve("radio.nav2.set", 110_500_000).Name == "NAV2_STBY_SET_HZ", "NAV2 event");
Must(Resolve("transponder.code.set", 1200).Data == 0x1200, "squawk 1200 BCD16");
Must(Resolve("transponder.code.set", 7).Data == 0x0007, "squawk leading zeros");
Must(Resolve("autopilot.vs.set", -500).Data == unchecked((uint)-500), "signed VS");
Must(Resolve("autopilot.hdg.on").Name == "AP_HDG_HOLD_ON", "HDG on");
Reject("autopilot.hdg.on", 1);
Reject("BAD_GARBAGE", 42);
Reject("radio.com1.set", 999_999_999);
Reject("radio.nav1.set", 110_523_000);
Reject("transponder.code.set", 8888);
Reject("transponder.code.set", 7890);
Reject("autopilot.heading.set", 400);
Reject("autopilot.vs.set", 6001);
Reject("autopilot.altitude.set", double.NaN);
Reject("autopilot.altitude.set", 1050);
Must(RadioStore.DecodeTransponderCode(0x1200) == "1200", "BCD code");
Must(RadioStore.DecodeTransponderCode(0x0007) == "0007", "BCD leading zeros");
Must(RadioStore.DecodeTransponderCode(0x1A00) is null, "invalid BCD digit");
Must(Resolve("lights.landing.on").Name == "LANDING_LIGHTS_ON", "lights");
Must(Resolve("lights.strobe.off").Name == "STROBES_OFF", "strobes");
Must(Resolve("pitot.on").Name == "PITOT_HEAT_ON", "pitot");
Must(Resolve("brakes.parking.set", 1).Name == "PARKING_BRAKE_SET", "park brake");
Reject("brakes.parking.set", 2);
Reject("lights.landing.on", 1);
Must(Resolve("flaps.increment").Name == "FLAPS_INCR", "flaps");
Must(Resolve("trim.down").Name == "ELEV_TRIM_DN", "trim");
Must(!AirbusCommandPolicy.MaySend("Asobo Airbus A320neo","autopilot.altitude.set"),"A320 AP write prohibited");
Must(!AirbusCommandPolicy.MaySend("FlyByWire A32NX","autopilot.on"),"addon AP write prohibited");
Must(AirbusCommandPolicy.MaySend("Airbus A320neo","radio.com1.swap"),"radio still allowed");
Must(AirbusCommandPolicy.MaySend("Cessna 172","autopilot.hdg.on"),"other aircraft unchanged");
Console.WriteLine("PASS: C1/C2 a C7 povolené události, XPDR BCD16 a limity.");
