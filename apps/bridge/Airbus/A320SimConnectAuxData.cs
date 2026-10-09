using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>Optional independent APU and total fuel SimVars; no ECAM authority.</summary>
[StructLayout(LayoutKind.Sequential,Pack=1)]
public struct A320SimConnectAuxData
{
    [SimConnect("APU PCT RPM","percent",SimConnectDataType.FloatDouble)]
    public double ApuRpmPercent;
    [SimConnect("APU GENERATOR ACTIVE","bool",SimConnectDataType.FloatDouble)]
    public double ApuGeneratorActive;
    [SimConnect("FUEL TOTAL QUANTITY WEIGHT","pounds",SimConnectDataType.FloatDouble)]
    public double FuelTotalWeightPounds;

    public readonly bool IsValid()=>
        double.IsFinite(ApuRpmPercent)&&ApuRpmPercent is >= 0 and <= 150
        &&double.IsFinite(ApuGeneratorActive)&&ApuGeneratorActive is >= 0 and <= 1
        &&double.IsFinite(FuelTotalWeightPounds)&&FuelTotalWeightPounds is >= 0 and <= 500000;
}
