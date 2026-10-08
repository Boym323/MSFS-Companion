using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>Nezávislý readback aktivních AP režimů, nikoliv předpoklad podle tlačítek.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectAutopilotModesData
{
    [SimConnect("AUTOPILOT HEADING LOCK", "bool", SimConnectDataType.FloatDouble)]
    public double Heading;
    [SimConnect("AUTOPILOT NAV1 LOCK", "bool", SimConnectDataType.FloatDouble)]
    public double Nav;
    [SimConnect("AUTOPILOT ALTITUDE LOCK", "bool", SimConnectDataType.FloatDouble)]
    public double Altitude;
    [SimConnect("AUTOPILOT VERTICAL HOLD", "bool", SimConnectDataType.FloatDouble)]
    public double VerticalSpeed;

    public readonly bool IsValid() => double.IsFinite(Heading)
        && double.IsFinite(Nav) && double.IsFinite(Altitude) && double.IsFinite(VerticalSpeed);
}
