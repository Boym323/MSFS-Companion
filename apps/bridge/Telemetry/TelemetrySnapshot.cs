namespace MsfsCompanion.Bridge.Telemetry;

public sealed record TelemetrySnapshot(
    DateTimeOffset TimestampUtc,
    string Aircraft,
    double Latitude,
    double Longitude,
    double AirspeedKnots,
    double AltitudeFeet,
    double VerticalSpeedFeetPerMinute,
    double HeadingDegrees,
    double PitchDegrees,
    double BankDegrees
);
