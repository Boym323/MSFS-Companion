using MsfsCompanion.Bridge.Navigation;

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
Console.WriteLine("PASS: C8 OurAirports CSV parsing, runways, frequencies, regional query and dateline.");
