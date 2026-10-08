using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectLandingData
{
    [SimConnect("PLANE TOUCHDOWN NORMAL VELOCITY", "feet per second", SimConnectDataType.FloatDouble)]
    public double TouchdownNormalVelocityFeetPerSecond;
    [SimConnect("G FORCE", "gforce", SimConnectDataType.FloatDouble)]
    public double GForce;

    public readonly bool IsValid() => double.IsFinite(TouchdownNormalVelocityFeetPerSecond)
        && double.IsFinite(GForce);
}
