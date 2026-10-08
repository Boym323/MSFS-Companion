namespace MsfsCompanion.Bridge.Telemetry;

// The Windows SimConnect adapter will implement this interface in the next milestone.
public interface ITelemetrySource
{
    string Mode { get; }
}
