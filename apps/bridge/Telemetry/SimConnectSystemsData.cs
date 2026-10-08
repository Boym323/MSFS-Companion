using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Pomalejší read-only skupina SimVars. Samostatný 1Hz odběr
/// nijak nemění rychlý 30Hz SimFrame přenos PFD.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectSystemsData
{
    [SimConnect("AIRSPEED TRUE", "knots", SimConnectDataType.FloatDouble)]
    public double TrueAirspeedKnots;

    [SimConnect("GROUND VELOCITY", "knots", SimConnectDataType.FloatDouble)]
    public double GroundSpeedKnots;

    [SimConnect("PLANE ALT ABOVE GROUND", "feet", SimConnectDataType.FloatDouble)]
    public double AltitudeAglFeet;

    [SimConnect("AMBIENT WIND DIRECTION", "degrees", SimConnectDataType.FloatDouble)]
    public double WindDirectionDegrees;

    [SimConnect("AMBIENT WIND VELOCITY", "knots", SimConnectDataType.FloatDouble)]
    public double WindSpeedKnots;

    [SimConnect("SIM ON GROUND", "bool", SimConnectDataType.FloatDouble)]
    public double SimOnGround;

    [SimConnect("FLAPS HANDLE PERCENT", "percent", SimConnectDataType.FloatDouble)]
    public double FlapsPercent;

    [SimConnect("GEAR HANDLE POSITION", "bool", SimConnectDataType.FloatDouble)]
    public double GearHandlePosition;

    [SimConnect("AUTOPILOT MASTER", "bool", SimConnectDataType.FloatDouble)]
    public double AutopilotMaster;

    [SimConnect("AUTOPILOT HEADING LOCK DIR", "degrees", SimConnectDataType.FloatDouble)]
    public double AutopilotSelectedHeadingDegrees;

    [SimConnect("AUTOPILOT ALTITUDE LOCK VAR", "feet", SimConnectDataType.FloatDouble)]
    public double AutopilotSelectedAltitudeFeet;

    [SimConnect("AUTOPILOT VERTICAL HOLD VAR", "feet per minute", SimConnectDataType.FloatDouble)]
    public double AutopilotSelectedVerticalSpeedFpm;

    [SimConnect("GENERAL ENG RPM:1", "rpm", SimConnectDataType.FloatDouble)]
    public double EngineRpm;

    [SimConnect("FUEL TOTAL QUANTITY", "gallons", SimConnectDataType.FloatDouble)]
    public double FuelGallons;

    public readonly bool IsValid()
    {
        var numbers = new[]
        {
            TrueAirspeedKnots, GroundSpeedKnots, AltitudeAglFeet,
            WindDirectionDegrees, WindSpeedKnots, SimOnGround, FlapsPercent,
            GearHandlePosition, AutopilotMaster, AutopilotSelectedHeadingDegrees,
            AutopilotSelectedAltitudeFeet, AutopilotSelectedVerticalSpeedFpm,
            EngineRpm, FuelGallons,
        };
        return numbers.All(double.IsFinite);
    }
}
