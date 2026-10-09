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
Console.WriteLine("A320 readback PASS: FCU slots, independent N1/N2, stale and identity guard");
