using MsfsCompanion.Bridge.Navigation;
using MsfsCompanion.Bridge.Integrations;

static void Check(bool result, string name)
{
    if (!result) throw new Exception("C8: " + name);
}

const string airports = """
id,ident,type,name,latitude_deg,longitude_deg,elevation_ft
1,LKPR,large_airport,"Václav Havel, Praha",50.1008,14.2632,1247
2,LKTB,medium_airport,"Brno Tuřany",49.151,16.694,778
3,CLOSED,closed,"Nepoužívané letiště",50.1,14.3,100
4,WRONG,small_airport,"Nesmyslná poloha",1000,14,0
""";
const string runways = """
id,airport_ident,length_ft,surface,closed,le_ident,le_latitude_deg,le_longitude_deg,he_ident,he_latitude_deg,he_longitude_deg
1,LKPR,12139,ASP,0,06,50.101,14.258,24,50.105,14.288
2,LKPR,5000,GRS,1,12,50.100,14.260,30,50.110,14.310
""";
const string navaids = """
id,ident,name,type,frequency_khz,latitude_deg,longitude_deg
1,PRG,"Praha VOR",VOR-DME,114300,50.100,14.200
2,BRN,"Brno NDB",NDB,350,49.100,16.700
3,X,none,UNKNOWN,100,50.1,14.2
""";
const string frequencies = """
id,airport_ident,type,description,frequency_mhz
1,LKPR,TWR,"Praha Tower, hlavní",118.100
2,LKPR,ATIS,Information,122.150
3,LKPR,INVALID,Do not use,800
""";
var a = OurAirportsCsv.Airports(airports);
var r = OurAirportsCsv.Runways(runways);
var n = OurAirportsCsv.Navaids(navaids);
var f = OurAirportsCsv.Frequencies(frequencies);
Check(a.Length == 2, "airport count, closed and invalid filtering");
Check(a[0].Name == "Václav Havel, Praha", "quoted commas");
Check(r.Length == 1 && r[0].LowIdent == "06" && r[0].HighIdent == "24",
    "open runway endpoints");
Check(n.Length == 2 && n[0].Type == "vor" && n[1].Type == "ndb", "VOR/NDB");
Check(f.Length == 2 && f[0].Description == "Praha Tower, hlavní", "frequency CSV");
var snapshot = new AviationCatalogSnapshot(DateTimeOffset.UtcNow, a, r, n, f);
var near = AviationCatalog.FindNearby(snapshot, 50.1, 14.25, 35);
Check(near.Count(x => x.Type == "airport") == 1, "nearby airport only");
Check(near.Count(x => x.Type == "runway") == 1, "runway nearby");
Check(near.Any(x => x.Type == "vor"), "VOR in map");
Check(!near.Any(x => x.Ident == "LKTB"), "outside radius");
var across = new AviationCatalogSnapshot(DateTimeOffset.UtcNow,
    [new AirportData("EDGE", "Dateline", "small_airport", 50, -179.9, null)],
    [], [], []);
Check(AviationCatalog.FindNearby(across, 50, 179.9, 25).Any(),
    "anti-meridian search");
// The cached geographic index must return exactly the same ordered airports
// as a full great-circle scan, also around the dateline and at high latitudes.
static double ReferenceDistance(double lat1, double lon1, double lat2, double lon2)
{
    const double rad = Math.PI / 180;
    var a = Math.Sin((lat2 - lat1) * rad / 2);
    var deltaLon = ((lon2 - lon1 + 540) % 360) - 180;
    var b = Math.Sin(deltaLon * rad / 2);
    var h = a * a + Math.Cos(lat1 * rad) * Math.Cos(lat2 * rad) * b * b;
    return 12742 * Math.Asin(Math.Sqrt(Math.Clamp(h, 0, 1)));
}
var rng = new Random(34219);
var worldwide = Enumerable.Range(0, 12000).Select(i =>
    new AirportData("S" + i.ToString("D5"), "Synthetic",
        "small_airport", rng.NextDouble() * 170 - 85,
        rng.NextDouble() * 360 - 180, null)).Concat(new AirportData[]
    {
        new("EAST", "East dateline", "small_airport", 0, 179.98, null),
        new("WEST", "West dateline", "small_airport", 0, -179.98, null),
        new("NORTH", "High latitude", "small_airport", 85.04, -179.9, null),
        new("SOUTH", "Low latitude", "small_airport", -85.04, 179.9, null),
    }).ToArray();
var worldwideSnapshot = new AviationCatalogSnapshot(DateTimeOffset.UtcNow,
    worldwide, [], [], []);
var queries = new (double Lat, double Lon, double Radius)[]
{
    (50, 14, 25), (0, 179.99, 60), (0, -179.99, 120),
    (85.05, 179.98, 200), (-85.05, -179.98, 200),
    (0, 0, 200), (-32, 151, 150)
};
foreach (var query in queries)
{
    var expected = worldwide
        .Select(item => (item, km: ReferenceDistance(query.Lat, query.Lon,
            item.Latitude, item.Longitude)))
        .Where(x => x.km <= query.Radius)
        .OrderBy(x => x.km).Take(70).Select(x => x.item.Ident).ToArray();
    var actual = AviationCatalog.FindNearby(worldwideSnapshot,
        query.Lat, query.Lon, query.Radius)
        .Where(x => x.Type == "airport").Select(x => x.Ident).ToArray();
    Check(actual.SequenceEqual(expected),
        $"spatial index must match full scan at {query.Lat}/{query.Lon}");
}

// C45: official-directory candidate selection must be deterministic and
// reject future or attacker-supplied URLs.
var now=new DateTimeOffset(2026,10,9,7,0,0,TimeSpan.Zero);
var listing="<a href='CZ_all_26-04-01.txt'>2026 April</a>"+
    "<a href='CZ_all_26-09-03.txt'>2026 September</a>"+
    "<a href='https://evil.invalid/hack.txt'>Ignore</a>"+
    "<a href='CZ_all_26-12-01.txt'>Not yet effective</a>";
var chosen=CzechAirspaceService.FindCurrentRelease(listing,now);
Check(chosen is { FileName:"CZ_all_26-09-03.txt",
    EffectiveDate:"2026-09-03" }, "select latest current official publication");
Check(CzechAirspaceService.FindCurrentRelease(
    "<a href='CZ_all_26-12-01.txt'>future</a>",now) is null,
    "future not-yet-effective release not selected");
Check(CzechAirspaceService.FindCurrentRelease(
    "<a href='https://evil.invalid/malicious.nupkg'>attack</a>",now) is null,
    "arbitrary links not used for OpenAir download");
Console.WriteLine("PASS: C8 OurAirports CSV parsing, runways, frequencies, regional query and dateline.");
