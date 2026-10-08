using System.Runtime.InteropServices;
using SimConnect.NET;
using SimConnect.NET.SimVar;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Jeden čtecí SimConnect data definition pro všech osm veličin.
/// Všechna pole jsou Float64, seřazená přesně v pořadí v SimConnect.
/// </summary>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
public struct SimConnectAircraftData
{
    [SimConnect("PLANE LATITUDE", "degrees", SimConnectDataType.FloatDouble)]
    public double Latitude;

    [SimConnect("PLANE LONGITUDE", "degrees", SimConnectDataType.FloatDouble)]
    public double Longitude;

    [SimConnect("AIRSPEED INDICATED", "knots", SimConnectDataType.FloatDouble)]
    public double AirspeedKnots;

    [SimConnect("INDICATED ALTITUDE", "feet", SimConnectDataType.FloatDouble)]
    public double AltitudeFeet;

    [SimConnect("VERTICAL SPEED", "feet per minute", SimConnectDataType.FloatDouble)]
    public double VerticalSpeedFeetPerMinute;

    [SimConnect("PLANE HEADING DEGREES MAGNETIC", "degrees", SimConnectDataType.FloatDouble)]
    public double HeadingDegrees;

    [SimConnect("PLANE PITCH DEGREES", "degrees", SimConnectDataType.FloatDouble)]
    public double PitchDegrees;

    [SimConnect("PLANE BANK DEGREES", "degrees", SimConnectDataType.FloatDouble)]
    public double BankDegrees;

    public readonly bool IsValid() =>
        double.IsFinite(Latitude) && Latitude is >= -90 and <= 90
        && double.IsFinite(Longitude) && Longitude is >= -180 and <= 180
        && double.IsFinite(AirspeedKnots) && AirspeedKnots is >= 0 and < 4000
        && double.IsFinite(AltitudeFeet)
        && double.IsFinite(VerticalSpeedFeetPerMinute)
        && double.IsFinite(HeadingDegrees)
        && double.IsFinite(PitchDegrees)
        && double.IsFinite(BankDegrees);

    public readonly TelemetrySnapshot ToSnapshot(string aircraft, DateTimeOffset timestamp) =>
        new(
            TimestampUtc: timestamp,
            Aircraft: aircraft,
            Latitude: Latitude,
            Longitude: Longitude,
            AirspeedKnots: AirspeedKnots,
            AltitudeFeet: AltitudeFeet,
            VerticalSpeedFeetPerMinute: VerticalSpeedFeetPerMinute,
            HeadingDegrees: ((HeadingDegrees % 360) + 360) % 360,
            PitchDegrees: PitchDegrees,
            BankDegrees: BankDegrees);
}
