using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>Asobo A320 candidate; pure read-only 1 Hz engine SimVars.</summary>
[StructLayout(LayoutKind.Sequential,Pack=1)]
public struct A320SimConnectEngineData
{
    [SimConnect("TURB ENG N1:1","percent",SimConnectDataType.FloatDouble)]
    public double N1Engine1;
    [SimConnect("TURB ENG N1:2","percent",SimConnectDataType.FloatDouble)]
    public double N1Engine2;
    [SimConnect("TURB ENG N2:1","percent",SimConnectDataType.FloatDouble)]
    public double N2Engine1;
    [SimConnect("TURB ENG N2:2","percent",SimConnectDataType.FloatDouble)]
    public double N2Engine2;
    [SimConnect("TURB ENG FUEL FLOW PPH:1","pounds per hour",SimConnectDataType.FloatDouble)]
    public double FuelFlowPph1;
    [SimConnect("TURB ENG FUEL FLOW PPH:2","pounds per hour",SimConnectDataType.FloatDouble)]
    public double FuelFlowPph2;

    public readonly bool IsValid() =>
        ValidPercent(N1Engine1)&&ValidPercent(N1Engine2)&&
        ValidPercent(N2Engine1)&&ValidPercent(N2Engine2)&&
        ValidFuel(FuelFlowPph1)&&ValidFuel(FuelFlowPph2);
    private static bool ValidPercent(double v)=>double.IsFinite(v)&&v is >= 0 and <= 150;
    private static bool ValidFuel(double v)=>double.IsFinite(v)&&v is >= 0 and <= 50000;
}
