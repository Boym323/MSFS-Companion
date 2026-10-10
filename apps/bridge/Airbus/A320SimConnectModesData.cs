using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Generic autopilot modes on MSFS 2020. Read-only; NOT equivalent to
/// proprietary Airbus FMA, managed/selected or AP1 vs AP2 engagement.
/// </summary>
[StructLayout(LayoutKind.Sequential,Pack=1)]
public struct A320SimConnectModesData
{
    [SimConnect("AUTOPILOT FLIGHT DIRECTOR ACTIVE","bool",SimConnectDataType.FloatDouble)]
    public double FlightDirector;
    [SimConnect("AUTOPILOT THROTTLE ARM","bool",SimConnectDataType.FloatDouble)]
    public double AutoThrottleArmed;
    [SimConnect("AUTOPILOT MANAGED THROTTLE ACTIVE","bool",SimConnectDataType.FloatDouble)]
    public double ManagedThrottleActive;
    [SimConnect("AUTOPILOT APPROACH ARM","bool",SimConnectDataType.FloatDouble)]
    public double ApproachArmed;
    [SimConnect("AUTOPILOT APPROACH ACTIVE","bool",SimConnectDataType.FloatDouble)]
    public double ApproachActive;
    [SimConnect("AUTOPILOT GLIDESLOPE ACTIVE","bool",SimConnectDataType.FloatDouble)]
    public double GlideSlopeActive;
    [SimConnect("AUTOPILOT HEADING LOCK","bool",SimConnectDataType.FloatDouble)]
    public double HeadingLock;
    [SimConnect("AUTOPILOT NAV1 LOCK","bool",SimConnectDataType.FloatDouble)]
    public double NavLock;

    private static bool Bool(double v) => double.IsFinite(v) && v is 0 or 1;
    public readonly bool IsValid() =>
        Bool(FlightDirector) && Bool(AutoThrottleArmed) &&
        Bool(ManagedThrottleActive) && Bool(ApproachArmed) &&
        Bool(ApproachActive) && Bool(GlideSlopeActive) &&
        Bool(HeadingLock) && Bool(NavLock);
}
