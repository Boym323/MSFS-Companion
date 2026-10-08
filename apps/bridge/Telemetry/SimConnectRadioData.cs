using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>Samostatná pomalá read-only radio subscription; nerozbije PFD při chybě.</summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectRadioData
{
    [SimConnect("COM ACTIVE FREQUENCY:1", "MHz", SimConnectDataType.FloatDouble)]
    public double Com1ActiveMHz;
    [SimConnect("COM STANDBY FREQUENCY:1", "MHz", SimConnectDataType.FloatDouble)]
    public double Com1StandbyMHz;
    [SimConnect("COM ACTIVE FREQUENCY:2", "MHz", SimConnectDataType.FloatDouble)]
    public double Com2ActiveMHz;
    [SimConnect("COM STANDBY FREQUENCY:2", "MHz", SimConnectDataType.FloatDouble)]
    public double Com2StandbyMHz;
    [SimConnect("NAV ACTIVE FREQUENCY:1", "MHz", SimConnectDataType.FloatDouble)]
    public double Nav1ActiveMHz;
    [SimConnect("NAV STANDBY FREQUENCY:1", "MHz", SimConnectDataType.FloatDouble)]
    public double Nav1StandbyMHz;
    [SimConnect("NAV ACTIVE FREQUENCY:2", "MHz", SimConnectDataType.FloatDouble)]
    public double Nav2ActiveMHz;
    [SimConnect("NAV STANDBY FREQUENCY:2", "MHz", SimConnectDataType.FloatDouble)]
    public double Nav2StandbyMHz;

    public readonly bool IsValid() => new[]
    {
        Com1ActiveMHz, Com1StandbyMHz, Com2ActiveMHz, Com2StandbyMHz,
        Nav1ActiveMHz, Nav1StandbyMHz, Nav2ActiveMHz, Nav2StandbyMHz
    }.All(double.IsFinite);
}
