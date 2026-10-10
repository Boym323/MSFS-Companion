using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Navigation;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Airbus;

/// <summary>
/// Explicit MCDU capability boundary. Standard GPS SimVars are NOT Asobo's
/// private MCDU display, route database, or avionics key events.
/// No write endpoint exists until an in-simulator contract is validated.
/// </summary>
public static class A320McduReadback
{
    public sealed record GpsLeg(
        bool FlightPlanActive, bool WaypointActive,
        int WaypointCount, int WaypointIndex,
        string? NextWaypointId, double? DistanceNauticalMiles,
        double? EteSeconds, double? DesiredTrackDegrees,
        double? CrossTrackNauticalMiles, double? TotalFlightPlanNauticalMiles,
        double? GroundTrackDegrees);
    public sealed record Status(
        bool Connected, string? Aircraft, string ProfileId,
        bool McduScreenAvailable, bool McduKeysAvailable,
        bool McduFlightPlanVerified, string[] KeyActions,
        string Source, double? GpsAgeMs, GpsLeg? Gps,
        string Note);

    public static Status Describe(string? title,bool trusted,
        NavigationSnapshot? nav,DateTimeOffset now)
    {
        var profile=AircraftProfileResolver.Resolve(title);
        var candidate=trusted&&profile.Id=="a320-asobo-candidate";
        var age=nav is null?(double?)null:(now-nav.TimestampUtc).TotalMilliseconds;
        var fresh=candidate&&age is >=0 and <6000;
        GpsLeg? gps=null;
        if(fresh&&nav is not null)
        {
            gps=new GpsLeg(nav.FlightPlanActive,nav.WaypointActive,
                nav.WaypointCount,nav.WaypointIndex,
                nav.WaypointActive?nav.NextWaypointId:null,
                nav.WaypointActive?nav.DistanceNauticalMiles:null,
                nav.WaypointActive?nav.EteSeconds:null,
                nav.WaypointActive?nav.DesiredTrackDegrees:null,
                nav.WaypointActive?nav.CrossTrackNauticalMiles:null,
                nav.TotalFlightPlanNauticalMiles,nav.GroundTrackDegrees);
        }
        return new Status(candidate,candidate?title:null,profile.Id,
            McduScreenAvailable:false,McduKeysAvailable:false,
            McduFlightPlanVerified:false,KeyActions:[],
            Source:"generic_gps_simvars",GpsAgeMs:fresh?age:null,
            Gps:gps,
            Note:"Pouze obecná GPS navigace. MCDU displej, letový plán FMS a " +
                 "MCDU tlačítka původního Asobo A320neo zatím nejsou dostupná. " +
                 "Žádné příkazy do letadla se neposílají.");
    }

    public static void MapA320Mcdu(this WebApplication app)
    {
        app.MapGet("/api/a320/mcdu/status",(
            HttpContext ctx,AircraftIdentityGuard identity,
            ITelemetrySource source,TelemetryHealth health,TelemetryStore telemetry,
            NavigationStore navigation)=>{
            ctx.Response.Headers.CacheControl="no-store";
            var now=DateTimeOffset.UtcNow;
            var trusted=source.Mode=="simconnect"&&
                health.Snapshot(source.Mode).Connected&&
                identity.Trusted(telemetry.Current.Aircraft,now);
            return Results.Ok(Describe(identity.Current.Title,trusted,
                trusted?navigation.Fresh(now):null,now));
        });
        // Deliberately no POST handler and no arbitrary key event mapping.
    }
}
