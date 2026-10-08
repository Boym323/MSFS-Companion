namespace MsfsCompanion.Bridge.Telemetry;

public sealed record AircraftSystemsSnapshot(
    DateTimeOffset TimestampUtc,
    string Mode,
    double TrueAirspeedKnots,
    double GroundSpeedKnots,
    double AltitudeAglFeet,
    double WindDirectionDegrees,
    double WindSpeedKnots,
    bool OnGround,
    double FlapsPercent,
    bool GearDown,
    bool AutopilotMaster,
    double AutopilotSelectedHeadingDegrees,
    double AutopilotSelectedAltitudeFeet,
    double AutopilotSelectedVerticalSpeedFpm,
    double EngineRpm,
    double FuelGallons);

/// <summary>
/// Nedostupné nebo staré údaje vrací jako null, ne jako zavádějící nuly.
/// Údaje se aktualizují nejvýše ~1× za sekundu.
/// </summary>
public sealed class AircraftSystemsStore
{
    private AircraftSystemsSnapshot? _current;
    public AircraftSystemsSnapshot? Current => Volatile.Read(ref _current);

    public void Update(AircraftSystemsSnapshot snapshot) =>
        Interlocked.Exchange(ref _current, snapshot);

    public void Reset() => Interlocked.Exchange(ref _current, null);

    public object Status()
    {
        var snapshot = Current;
        var age = snapshot is null ? (double?)null
            : Math.Max(0, (DateTimeOffset.UtcNow - snapshot.TimestampUtc).TotalMilliseconds);
        var connected = age is < 10_000;
        return new
        {
            connected,
            lastUpdatedUtc = connected ? snapshot?.TimestampUtc : null,
            sampleAgeMs = connected ? age : null,
            systems = connected ? snapshot : null,
        };
    }

    public static AircraftSystemsSnapshot FromSimConnect(
        SimConnectSystemsData value, string mode, DateTimeOffset at) => new(
        TimestampUtc: at,
        Mode: mode,
        TrueAirspeedKnots: value.TrueAirspeedKnots,
        GroundSpeedKnots: value.GroundSpeedKnots,
        AltitudeAglFeet: value.AltitudeAglFeet,
        WindDirectionDegrees: ((value.WindDirectionDegrees % 360) + 360) % 360,
        WindSpeedKnots: Math.Max(0, value.WindSpeedKnots),
        OnGround: value.SimOnGround > 0.5,
        FlapsPercent: Math.Clamp(value.FlapsPercent, 0, 100),
        GearDown: value.GearHandlePosition > 0.5,
        AutopilotMaster: value.AutopilotMaster > 0.5,
        AutopilotSelectedHeadingDegrees: ((value.AutopilotSelectedHeadingDegrees % 360) + 360) % 360,
        AutopilotSelectedAltitudeFeet: value.AutopilotSelectedAltitudeFeet,
        AutopilotSelectedVerticalSpeedFpm: value.AutopilotSelectedVerticalSpeedFpm,
        EngineRpm: Math.Max(0, value.EngineRpm),
        FuelGallons: Math.Max(0, value.FuelGallons));
}
