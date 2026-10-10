using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// GPS WP NEXT ID is a string SimVar. Like TITLE, it must use the native
/// empty unit rather than the scalar API's invalid "string" unit.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1, CharSet = CharSet.Ansi)]
public struct SimConnectNextWaypointIdData
{
    [SimConnect("GPS WP NEXT ID", "", SimConnectDataType.String256)]
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
    public string Name;
}
