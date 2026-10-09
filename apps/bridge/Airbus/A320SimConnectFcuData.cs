using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>Generic simulator AP reference values, not Airbus FMA verification.</summary>
[StructLayout(LayoutKind.Sequential,Pack=1)]
public struct A320SimConnectFcuData
{
    [SimConnect("AUTOPILOT AIRSPEED HOLD VAR","knots",SimConnectDataType.FloatDouble)]
    public double SelectedSpeedKnots;
    [SimConnect("AUTOPILOT MACH HOLD VAR","mach",SimConnectDataType.FloatDouble)]
    public double SelectedMach;
    [SimConnect("AUTOPILOT HEADING LOCK DIR","degrees",SimConnectDataType.FloatDouble)]
    public double SelectedHeadingDegrees;
    [SimConnect("AUTOPILOT ALTITUDE LOCK VAR","feet",SimConnectDataType.FloatDouble)]
    public double SelectedAltitudeFeet;
    [SimConnect("AUTOPILOT VERTICAL HOLD VAR","feet per minute",SimConnectDataType.FloatDouble)]
    public double SelectedVerticalSpeedFpm;
    [SimConnect("AUTOPILOT SPEED SLOT INDEX","number",SimConnectDataType.FloatDouble)]
    public double SpeedSlotIndex;
    [SimConnect("AUTOPILOT HEADING SLOT INDEX","number",SimConnectDataType.FloatDouble)]
    public double HeadingSlotIndex;
    [SimConnect("AUTOPILOT ALTITUDE SLOT INDEX","number",SimConnectDataType.FloatDouble)]
    public double AltitudeSlotIndex;
    [SimConnect("AUTOPILOT VS SLOT INDEX","number",SimConnectDataType.FloatDouble)]
    public double VerticalSpeedSlotIndex;
    [SimConnect("AUTOPILOT MASTER","bool",SimConnectDataType.FloatDouble)]
    public double AutopilotMaster;

    public readonly bool IsValid()=>new[]{SelectedSpeedKnots,SelectedMach,
        SelectedHeadingDegrees,SelectedAltitudeFeet,SelectedVerticalSpeedFpm,
        SpeedSlotIndex,HeadingSlotIndex,AltitudeSlotIndex,VerticalSpeedSlotIndex,
        AutopilotMaster}.All(double.IsFinite)
        &&SelectedSpeedKnots is >= 0 and <= 600
        &&SelectedMach is >= 0 and <= 2
        &&SelectedHeadingDegrees is >= -360 and <= 360
        &&AutopilotMaster is 0 or 1
        &&SelectedAltitudeFeet is >= -2000 and <= 65000
        &&Math.Abs(SelectedVerticalSpeedFpm)<=12000
        &&ValidSlot(SpeedSlotIndex)&&ValidSlot(HeadingSlotIndex)
        &&ValidSlot(AltitudeSlotIndex)&&ValidSlot(VerticalSpeedSlotIndex);
    private static bool ValidSlot(double v)=>v>=0&&v<=3&&v==Math.Truncate(v);
}
