using MsfsCompanion.Bridge.Airbus;
using System.Text.Json;

static void Check(bool ok,string message)
{
    if(!ok)throw new Exception(message);
}
static JsonElement Inspect(A320ReadbackStore store,string title,bool trusted,DateTimeOffset at)=>
    JsonSerializer.SerializeToElement(store.Status(title,trusted,at),
        new JsonSerializerOptions(JsonSerializerDefaults.Web));

var at=new DateTimeOffset(2026,10,9,10,0,0,TimeSpan.Zero);
var store=new A320ReadbackStore();
var engines=new A320SimConnectEngineData {
    N1Engine1=72.5,N1Engine2=71.8,N2Engine1=83.3,N2Engine2=82.8,
    FuelFlowPph1=2500,FuelFlowPph2=2600
};
Check(engines.IsValid(),"valid two-engine turbine readback");
store.UpdateEngines(engines,at);
var status=Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(1));
Check(status.GetProperty("connected").GetBoolean(),"candidate connected");
Check(status.GetProperty("engines").GetProperty("n1Engine2").GetDouble()==71.8,
    "independent engine 2 N1");
Check(status.GetProperty("fcu").ValueKind==JsonValueKind.Null,"no FCU is not zero");
engines.N1Engine1=double.NaN;
Check(!engines.IsValid(),"reject NaN engine data");
store.UpdateEngines(engines,at.AddSeconds(2));
Check(Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(2))
    .GetProperty("engines").GetProperty("n1Engine1").GetDouble()==72.5,
    "invalid frame never overwrites previous valid values");
Check(Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(7))
    .GetProperty("engines").ValueKind==JsonValueKind.Null,"expired engines hidden");
var fcu=new A320SimConnectFcuData {
    SelectedSpeedKnots=250,SelectedMach=0.78,SelectedHeadingDegrees=270,
    SelectedAltitudeFeet=36000,SelectedVerticalSpeedFpm=-700,
    SpeedSlotIndex=2,HeadingSlotIndex=1,AltitudeSlotIndex=2,
    VerticalSpeedSlotIndex=1,AutopilotMaster=1
};
Check(fcu.IsValid(),"valid FCU readback");
fcu.AutopilotMaster=2;
Check(!fcu.IsValid(),"invalid AP boolean must not display OFF/ON");
fcu.AutopilotMaster=1;
fcu.SelectedHeadingDegrees=721;
Check(!fcu.IsValid(),"invalid heading must not wrap into plausible HDG");
fcu.SelectedHeadingDegrees=270;
store.UpdateFcu(fcu,at);
var read=Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(1));
Check(read.GetProperty("fcu").GetProperty("speedSlotIndex").GetInt32()==2,
    "raw speed slot index must be retained without assuming FMA state");
Check(!read.GetProperty("fmaVerified").GetBoolean(),"FMA remains unverified");
Check(read.GetProperty("fcu").GetProperty("verification").GetString()
    =="generic_simvars_unverified_fma","annotated generic readback");
fcu.VerticalSpeedSlotIndex=99;
Check(!fcu.IsValid(),"invalid FCU slot rejected");
Check(Inspect(store,"FlyByWire A32NX",true,at.AddSeconds(1))
    .GetProperty("fcu").ValueKind==JsonValueKind.Null,"addon cannot reuse Asobo snapshot");
Check(Inspect(store,"Airbus A320 Neo",false,at.AddSeconds(1))
    .GetProperty("engines").ValueKind==JsonValueKind.Null,"untrusted aircraft cannot leak previous values");
var aux=new A320SimConnectAuxData{
    ApuRpmPercent=98,ApuGeneratorActive=1,FuelTotalWeightPounds=22000
};
Check(aux.IsValid(),"valid APU and FOB values");
store.UpdateAux(aux,at);
var auxStatus=Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(1));
Check(auxStatus.GetProperty("aux").GetProperty("apuRpmPercent").GetDouble()==98,
    "APU readback");
Check(auxStatus.GetProperty("aux").GetProperty("fuelTotalWeightPounds").GetDouble()==22000,
    "FOB pounds readback");
aux.FuelTotalWeightPounds=double.NaN;
Check(!aux.IsValid(),"invalid fuel weight rejected");
store.UpdateAux(aux,at.AddSeconds(2));
Check(Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(7))
    .GetProperty("aux").ValueKind==JsonValueKind.Null,"stale APU snapshot hidden");
store.Reset();
Check(Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(1))
    .GetProperty("engines").ValueKind==JsonValueKind.Null,"reset discards old snapshots");

var modeData = new A320SimConnectModesData {
    FlightDirector=1,AutoThrottleArmed=1,ManagedThrottleActive=0,
    ApproachArmed=1,ApproachActive=0,GlideSlopeActive=0,
    HeadingLock=0,NavLock=1
};
Check(modeData.IsValid(),"valid generic AP mode flags");
store.UpdateModes(modeData,at);
var modeStatus=Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(1));
Check(modeStatus.GetProperty("modes").GetProperty("flightDirector").GetBoolean(),
    "FD readback");
Check(!modeStatus.GetProperty("modes").GetProperty("approachActive").GetBoolean(),
    "AP approach not guessed");
modeData.FlightDirector=2;
Check(!modeData.IsValid(),"invalid FD value rejected");
store.UpdateModes(modeData,at.AddSeconds(2));
Check(Inspect(store,"Airbus A320 Neo",true,at.AddSeconds(7))
    .GetProperty("modes").ValueKind==JsonValueKind.Null,
    "stale AP modes hidden");
Check(Inspect(store,"FlyByWire A32NX",true,at.AddSeconds(1))
    .GetProperty("modes").ValueKind==JsonValueKind.Null,
    "addon AP modes blocked");

var commandTable = new (string Name,double Value,string Event,uint Data)[] {
    ("a320.fcu.speed.set",250,"AP_SPD_VAR_SET",250),
    ("a320.fcu.mach.set",0.78,"AP_MACH_VAR_SET",78),
    ("a320.fcu.heading.set",270,"HEADING_BUG_SET",270),
    ("a320.fcu.altitude.set",36000,"AP_ALT_VAR_SET_ENGLISH",36000),
    ("a320.fcu.vs.set",-700,"AP_VS_VAR_SET_ENGLISH",unchecked((uint)-700))
};
foreach(var (name,value,eventName,data) in commandTable)
{
    Check(A320FcuCommandPolicy.TryResolve(
        new A320FcuCommandPolicy.Selection(name,value),out var command) &&
        command!.Name==eventName && command.Data==data,"command "+name);
}
foreach(var (name,value) in new (string,double)[] {
    ("a320.fcu.speed.set",10),("a320.fcu.speed.set",250.1),
    ("a320.fcu.mach.set",0.783),("a320.fcu.mach.set",double.NaN),
    ("a320.fcu.heading.set",360),("a320.fcu.altitude.set",1051),
    ("a320.fcu.vs.set",6100),("a320.fcu.ap1.on",1),
    ("autopilot.on",1),("a320.fcu.mode.managed",1)
})
    Check(!A320FcuCommandPolicy.TryResolve(
        new A320FcuCommandPolicy.Selection(name,value),out _),
        "deny unsupported or invalid "+name);
Check(!A320FcuCommandPolicy.TryResolve(null,out _),"null command denied");

Check(store.FreshFcu(at.AddSeconds(1)) is null,"reset must remove FCU before writes");
// Restore the intentionally invalid VS slot from the earlier negative test.
fcu.VerticalSpeedSlotIndex=1;
Check(fcu.IsValid(),"fresh control reference sample must be valid");
store.UpdateFcu(fcu,at);
Check(store.FreshFcu(at.AddMilliseconds(500)) is not null,"fresh FCU");
Check(store.FreshFcu(at.AddSeconds(4)) is null,"expired FCU blocks controls");

var gate = new A320FcuControlGate();
var generation=100L;
var title="Airbus A320 Neo";
Check(!gate.Armed(generation,title,at),"default denied");
gate.Arm(generation,title,at);
Check(gate.Armed(generation,title,at.AddMinutes(1)),"pilot opt-in");
Check(!gate.Armed(generation+1,title,at.AddMinutes(1)),"reconnect revokes permission");
Check(!gate.Armed(generation,"FlyByWire A32NX",at.AddMinutes(1)),"new aircraft denied");
Check(!gate.Armed(generation,title,at.AddMinutes(31)),"opt-in expires");
gate.Arm(generation,title,at);
var selection=new A320FcuCommandPolicy.Selection("a320.fcu.heading.set",270);
gate.Sent(selection,generation,title,at.AddSeconds(1),at);
var pending=JsonSerializer.SerializeToElement(gate.Evidence(generation,title,
    at.AddSeconds(2),null));
Check(pending.GetProperty("state").GetString()=="pending","pending is not success");
store.UpdateFcu(fcu,at.AddSeconds(3));
var observed=JsonSerializer.SerializeToElement(gate.Evidence(generation,title,
    at.AddSeconds(4),store.FreshFcu(at.AddSeconds(4))));
Check(observed.GetProperty("state").GetString()=="simvar_observed",
    "fresh matching SimVar is evidence not FCU proof");
var expired=JsonSerializer.SerializeToElement(gate.Evidence(generation,title,
    at.AddSeconds(10),null));
Check(expired.GetProperty("state").GetString()=="unconfirmed","unconfirmed timeout");
gate.Disarm();
Check(!gate.Armed(generation,title,at.AddSeconds(5)),"pilot revocation");


// In-sim WASM protocol: fixed-size packets and exact semantic operation IDs.
Check(System.Runtime.InteropServices.Marshal.SizeOf<A320WasmProtocol.Command>()==16,
    "WASM request packet size");
Check(System.Runtime.InteropServices.Marshal.SizeOf<A320WasmProtocol.Reply>()==16,
    "WASM reply packet size");
var wasmActions=new [] {
    ("a320.fcu.speed.selected",1u),
    ("a320.fcu.speed.managed",2u),
    ("a320.fcu.heading.selected",3u),
    ("a320.fcu.heading.managed",4u),
    ("a320.fcu.altitude.selected",5u),
    ("a320.fcu.altitude.managed",6u)
};
Check(A320WasmProtocol.AvailableActions.Count==6,"limited module command set");
foreach(var (command,expected) in wasmActions)
    Check(A320WasmProtocol.TryResolve(command,out var code) && code==expected,
        "WASM op mapping: "+command);
Check(!A320WasmProtocol.TryResolve("a320.fcu.ap1.on",out _),"no AP1 activation");
Check(!A320WasmProtocol.TryResolve("a320.fcu.speed.set;EXEC",out _),
    "no arbitrary WASM script");
Check(!A320WasmProtocol.TryResolve("autopilot.on",out _),"no generic AP bypass");
Check(!A320WasmProtocol.TryResolve(null,out _),"null WASM op denied");
Check(A320WasmProtocol.Valid(new A320WasmProtocol.Reply {
    Magic=A320WasmProtocol.Magic,Version=1,Sequence=42,Status=1
},42),"valid ack");
Check(!A320WasmProtocol.Valid(new A320WasmProtocol.Reply {
    Magic=A320WasmProtocol.Magic,Version=2,Sequence=42,Status=1
},42),"protocol version mismatch denied");
Check(!A320WasmProtocol.Valid(new A320WasmProtocol.Reply {
    Magic=A320WasmProtocol.Magic,Version=1,Sequence=41,Status=1
},42),"stale/replayed sequence denied");
Check(!A320WasmProtocol.Valid(new A320WasmProtocol.Reply {
    Magic=0,Version=1,Sequence=42,Status=1
},42),"foreign packet denied");

Console.WriteLine("A320 readback PASS: FCU slots, independent N1/N2, stale and identity guard");
