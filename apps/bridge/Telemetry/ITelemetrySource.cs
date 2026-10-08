namespace MsfsCompanion.Bridge.Telemetry;

// Sdílené rozhraní pro vývojový mock a skutečný Windows SimConnect.
public interface ITelemetrySource
{
    string Mode { get; }
}
