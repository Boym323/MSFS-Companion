using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>Oddělená čtecí definice: nefunkční XPDR nesmí vyřadit COM/NAV.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectTransponderData
{
    [SimConnect("TRANSPONDER CODE:1", "BCD16", SimConnectDataType.FloatDouble)]
    public double CodeBcd16;
}
