using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>Pomalejší nezávislá čtecí subscription – neblokuje rychlou telemetrii.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectCockpitSystemsData
{
    [SimConnect("LIGHT LANDING", "bool", SimConnectDataType.FloatDouble)]
    public double Landing;
    [SimConnect("LIGHT TAXI", "bool", SimConnectDataType.FloatDouble)]
    public double Taxi;
    [SimConnect("LIGHT NAV", "bool", SimConnectDataType.FloatDouble)]
    public double Nav;
    [SimConnect("LIGHT BEACON", "bool", SimConnectDataType.FloatDouble)]
    public double Beacon;
    [SimConnect("LIGHT STROBE", "bool", SimConnectDataType.FloatDouble)]
    public double Strobe;
    [SimConnect("PITOT HEAT", "bool", SimConnectDataType.FloatDouble)]
    public double Pitot;
    [SimConnect("BRAKE PARKING POSITION", "bool", SimConnectDataType.FloatDouble)]
    public double ParkingBrake;

    public readonly bool IsValid() => new[] { Landing, Taxi, Nav, Beacon, Strobe, Pitot, ParkingBrake }.All(double.IsFinite);
}
