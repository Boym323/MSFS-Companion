using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Navigation;

/// <summary>Oddělená, pomalá read-only SimConnect GPS subscription.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectNavigationData
{
    [SimConnect("GPS IS ACTIVE FLIGHT PLAN", "bool", SimConnectDataType.FloatDouble)]
    public double PlanActive;
    [SimConnect("GPS IS ACTIVE WAY POINT", "bool", SimConnectDataType.FloatDouble)]
    public double WaypointActive;
    [SimConnect("GPS FLIGHT PLAN WP COUNT", "number", SimConnectDataType.FloatDouble)]
    public double WaypointCount;
    [SimConnect("GPS FLIGHT PLAN WP INDEX", "number", SimConnectDataType.FloatDouble)]
    public double WaypointIndex;
    [SimConnect("GPS WP NEXT LAT", "degrees", SimConnectDataType.FloatDouble)]
    public double NextLatitude;
    [SimConnect("GPS WP NEXT LON", "degrees", SimConnectDataType.FloatDouble)]
    public double NextLongitude;
    [SimConnect("GPS WP PREV VALID", "bool", SimConnectDataType.FloatDouble)]
    public double PreviousValid;
    [SimConnect("GPS WP PREV LAT", "degrees", SimConnectDataType.FloatDouble)]
    public double PreviousLatitude;
    [SimConnect("GPS WP PREV LON", "degrees", SimConnectDataType.FloatDouble)]
    public double PreviousLongitude;
    [SimConnect("GPS WP DISTANCE", "meters", SimConnectDataType.FloatDouble)]
    public double DistanceMeters;
    [SimConnect("GPS WP ETE", "seconds", SimConnectDataType.FloatDouble)]
    public double EteSeconds;
    [SimConnect("GPS WP DESIRED TRACK", "degrees", SimConnectDataType.FloatDouble)]
    public double DesiredTrackDegrees;
    [SimConnect("GPS WP CROSS TRK", "meters", SimConnectDataType.FloatDouble)]
    public double CrossTrackMeters;
    [SimConnect("GPS FLIGHTPLAN TOTAL DISTANCE", "meters", SimConnectDataType.FloatDouble)]
    public double TotalDistanceMeters;
    [SimConnect("GPS GROUND TRUE TRACK", "degrees", SimConnectDataType.FloatDouble)]
    public double GroundTrackDegrees;

    public readonly bool IsValid() => new[] { PlanActive, WaypointActive, WaypointCount,
        WaypointIndex, NextLatitude, NextLongitude, PreviousValid, PreviousLatitude,
        PreviousLongitude, DistanceMeters, EteSeconds, DesiredTrackDegrees,
        CrossTrackMeters, TotalDistanceMeters, GroundTrackDegrees }.All(double.IsFinite);
}
