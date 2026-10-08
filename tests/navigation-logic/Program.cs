using MsfsCompanion.Bridge.Navigation;

static void Assert(bool value, string message)
{
    if (!value) throw new Exception(message);
}
var store = new NavigationStore();
Assert(store.Current is null, "initially empty");
var at = DateTimeOffset.UtcNow;
store.Update(new SimConnectNavigationData
{
    PlanActive = 1,
    WaypointActive = 1,
    WaypointCount = 5,
    WaypointIndex = 2,
    NextLatitude = 50.1,
    NextLongitude = 14.3,
    PreviousValid = 1,
    PreviousLatitude = 50,
    PreviousLongitude = 14,
    DistanceMeters = 3704,
    EteSeconds = 600,
    DesiredTrackDegrees = -90,
    CrossTrackMeters = 1852,
    TotalDistanceMeters = 18520,
    GroundTrackDegrees = 720,
}, at);
store.UpdateName("LKPR", at);
Assert(store.Current?.NextWaypoint is not null, "waypoint coordinates");
Assert(store.Current?.DistanceNauticalMiles == 2, "distance meters to NM");
Assert(store.Current?.DesiredTrackDegrees == 270, "track modulo 360");
Assert(store.Current?.CrossTrackNauticalMiles == 1, "XTK meters to NM");
Assert(store.Current?.WaypointCount == 5 && store.Current?.WaypointIndex == 2, "plan index");
store.Update(new SimConnectNavigationData
{
    WaypointActive = 1,
    NextLatitude = 0,
    NextLongitude = 0
}, at);
Assert(store.Current?.NextWaypoint is null, "zero coordinate suppressed");
store.Reset();
Assert(store.Current is null, "disconnect reset");
Console.WriteLine("PASS: C4 navigace, waypoint invalidace, jednotky a reset");
