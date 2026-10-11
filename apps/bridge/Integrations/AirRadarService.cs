using System.Text.Json;
using System.Net.Http.Headers;

namespace MsfsCompanion.Bridge.Integrations;

/// <summary>Explicitly requested, read-only public AirRadar snapshots.
/// The upstream address is fixed: never accept a URL from a browser.
/// No extra Windows process or SimConnect subscription is required.</summary>
public static class AirRadarService
{
    private sealed record Aircraft(string Hex,string? Callsign,double Latitude,double Longitude,
        double? AltitudeFeet,double? TrackDegrees,double SeenPosSeconds,string? Source);
    private static readonly HttpClient Client = MakeClient();
    private static readonly SemaphoreSlim Gate = new(1,1);
    private static Aircraft[] _cached = [];
    private static DateTimeOffset _fetched = DateTimeOffset.MinValue;
    private static DateTimeOffset _attempted = DateTimeOffset.MinValue;
    private static string? _error;

    private static HttpClient MakeClient()
    {
        var client=new HttpClient(new HttpClientHandler {AllowAutoRedirect=false})
        {
            BaseAddress=new Uri("https://airradar.pomykal.cz/"),
            Timeout=TimeSpan.FromSeconds(10)
        };
        client.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("Kokpit","0.2"));
        return client;
    }

    private static string? Text(JsonElement item,string key,int limit)
    {
        if(!item.TryGetProperty(key,out var element)||element.ValueKind!=JsonValueKind.String)
            return null;
        var s=element.GetString();
        return s is null?null:s[..Math.Min(s.Length,limit)];
    }
    private static double? Number(JsonElement item,string key)
    {
        return item.TryGetProperty(key,out var v)&&v.ValueKind==JsonValueKind.Number
            &&v.TryGetDouble(out var n)&&double.IsFinite(n)?n:null;
    }
    private static bool Valid(double latitude,double longitude)=>
        double.IsFinite(latitude)&&double.IsFinite(longitude)&&
        Math.Abs(latitude)<=85.05&&Math.Abs(longitude)<=180;
    private static double DistanceKm(double a,double b,double c,double d)
    {
        const double rad=Math.PI/180;
        var x=Math.Pow(Math.Sin((c-a)*rad/2),2)+
            Math.Cos(a*rad)*Math.Cos(c*rad)*Math.Pow(Math.Sin((d-b)*rad/2),2);
        return 12742*Math.Asin(Math.Min(1,Math.Sqrt(Math.Max(0,x))));
    }

    private static async Task RefreshAsync(CancellationToken ct)
    {
        if(DateTimeOffset.UtcNow-_attempted<TimeSpan.FromSeconds(30))return;
        await Gate.WaitAsync(ct);
        try
        {
            if(DateTimeOffset.UtcNow-_attempted<TimeSpan.FromSeconds(30))return;
            _attempted=DateTimeOffset.UtcNow;
            try
            {
                using var response=await Client.GetAsync("api/aircraft",
                    HttpCompletionOption.ResponseHeadersRead,ct);
                if(!response.IsSuccessStatusCode||response.Content.Headers.ContentLength is > 8_000_000)
                    throw new IOException("AirRadar unavailable or response too large");
                await using var input=await response.Content.ReadAsStreamAsync(ct);
                using var bytes=new MemoryStream();
                var block=new byte[16384];
                int length;
                while((length=await input.ReadAsync(block.AsMemory(),ct))>0)
                {
                    if(bytes.Length+length>8_000_000)throw new IOException("AirRadar response too large");
                    bytes.Write(block,0,length);
                }
                bytes.Position=0;
                using var doc=await JsonDocument.ParseAsync(bytes,
                    new JsonDocumentOptions{MaxDepth=40},ct);
                var root=doc.RootElement;
                if(root.TryGetProperty("sourceOnline",out var online)&&
                    online.ValueKind==JsonValueKind.False)throw new IOException("AirRadar source offline");
                if(!root.TryGetProperty("aircraft",out var values)||
                    values.ValueKind!=JsonValueKind.Array)throw new JsonException("Missing aircraft");
                var parsed=new List<Aircraft>();
                foreach(var item in values.EnumerateArray().Take(10000))
                {
                    if(item.ValueKind!=JsonValueKind.Object)continue;
                    var lat=Number(item,"lat");var lon=Number(item,"lon");
                    var age=Number(item,"seenPosSeconds");
                    var hex=Text(item,"icaoHex",12);
                    if(lat is null||lon is null||!Valid(lat.Value,lon.Value)||
                        age is null||age<0||age>30||hex is null||
                        hex.Length!=6||!hex.All(Uri.IsHexDigit))continue;
                    parsed.Add(new Aircraft(hex.ToUpperInvariant(),
                        Text(item,"callsign",16),lat.Value,lon.Value,
                        Number(item,"altitude"),Number(item,"track"),age.Value,
                        Text(item,"source",24)));
                }
                _cached=parsed.ToArray();
                _fetched=DateTimeOffset.UtcNow;
                _error=null;
            }
            catch(Exception ex) when(ex is HttpRequestException or TaskCanceledException or
                IOException or JsonException)
            {
                _error="AirRadar není dostupný nebo nevrací validní data.";
            }
        }
        finally{Gate.Release();}
    }

    public static void MapAirRadar(this WebApplication app)
    {
        app.MapGet("/api/integrations/airradar/nearby",async(
            double lat,double lon,double radiusKm,CancellationToken ct)=>{
            if(!Valid(lat,lon)||!double.IsFinite(radiusKm)||radiusKm<1||radiusKm>200)
                return Results.BadRequest(new{error="Neplatné souřadnice nebo poloměr."});
            await RefreshAsync(ct);
            var stale=_fetched==DateTimeOffset.MinValue||
                DateTimeOffset.UtcNow-_fetched>TimeSpan.FromSeconds(90);
            var targets=stale?[]:_cached
                .Select(p=>(p,km:DistanceKm(lat,lon,p.Latitude,p.Longitude)))
                .Where(p=>p.km<=radiusKm).OrderBy(p=>p.km).Take(40)
                .Select(item=>new {
                    hex=item.p.Hex,callsign=item.p.Callsign,
                    latitude=item.p.Latitude,longitude=item.p.Longitude,
                    altitudeFeet=item.p.AltitudeFeet,trackDegrees=item.p.TrackDegrees,
                    distanceNm=Math.Round(item.km/1.852,1),
                    seenPosSeconds=item.p.SeenPosSeconds,source=item.p.Source
                }).ToArray();
            return Results.Ok(new{available=!stale,stale,
                updatedAt=_fetched==DateTimeOffset.MinValue?(DateTimeOffset?)null:_fetched,
                source="AirRadar public API",error=_error,aircraft=targets});
        });
    }
}
