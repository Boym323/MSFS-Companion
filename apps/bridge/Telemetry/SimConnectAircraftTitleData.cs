using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// SimConnect string data definitions require an empty native unit name.
/// The scalar Subscribe(string, unit, ...) API in SimConnect.NET 0.2.2
/// rejects empty units, so TITLE must be read through the struct API.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1, CharSet = CharSet.Ansi)]
public struct SimConnectAircraftTitleData
{
    [SimConnect("TITLE", "", SimConnectDataType.String256)]
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
    public string Title;
}
