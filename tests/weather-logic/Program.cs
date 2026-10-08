using MsfsCompanion.Bridge.Integrations;
static void Check(bool condition, string message) {
    if (!condition) throw new Exception("C19 NOAA: " + message);
}
var past = DateTimeOffset.UtcNow.AddMinutes(-30);
var now = DateTimeOffset.UtcNow;
var old = new WeatherReport("LKPR", "METAR OLD", "TAF OLD", past,
    true, "NOAA Aviation Weather Center");
var partial = AviationWeatherService.Combine("LKPR", old,
    new WeatherFetch("METAR NEW", true), new WeatherFetch(null, false), now);
Check(partial.Metar == "METAR NEW", "keep fresh METAR despite TAF failure");
Check(partial.Taf == "TAF OLD", "retain last good TAF");
Check(partial.Stale && partial.Error is not null, "mark partial result stale");
Check(partial.FetchedAt == past, "do not invent a fresh time for stale TAF");
var bothFailed = AviationWeatherService.Combine("LKPR", old,
    new WeatherFetch(null, false), new WeatherFetch(null, false), now);
Check(bothFailed.Metar == "METAR OLD" && bothFailed.Taf == "TAF OLD",
    "offline fallback keeps both previous products");
Check(bothFailed.Stale, "offline fallback is marked stale");
var empty204 = AviationWeatherService.Combine("LKPR", old,
    new WeatherFetch(null, true), new WeatherFetch(null, true), now);
Check(!empty204.Available && !empty204.Stale && empty204.Metar is null &&
    empty204.Taf is null, "HTTP 204 means valid but no reports, not old data");
var isolated = AviationWeatherService.Combine("LKTB", null,
    new WeatherFetch("METAR BRNO", true), new WeatherFetch(null, false), now);
Check(isolated.Available && isolated.Stale && isolated.Metar == "METAR BRNO",
    "first request can still show partial data");
Check(AviationWeatherService.ValidAirport("LKPR"), "valid ICAO");
Check(AviationWeatherService.ValidAirport("EGLL"), "valid ICAO 2");
Check(!AviationWeatherService.ValidAirport("LKPR.local"), "no DNS injection");
Check(!AviationWeatherService.ValidAirport("1234"), "no numeric code");
Check(!AviationWeatherService.ValidAirport("AB\nC"), "no whitespace");
Console.WriteLine("PASS: C19 NOAA partial recovery, stale timestamps, HTTP 204, ICAO validation.");