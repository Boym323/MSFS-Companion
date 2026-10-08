using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace MsfsCompanion.Bridge.Integrations;

public sealed record HazardPoint(double Latitude, double Longitude);
public sealed record AviationHazard(string Kind, string Description,
    HazardPoint[] Boundary, string? ValidFrom, string? ValidTo);

/// <summary>
/// On-demand International SIGMET GeoJSON. Only validated polygons are mapped.
/// No inference of missing geometries or simulated weather.
/// </summary>
public sealed class AviationHazardsService
{
    private static readonly HttpClient Http = CreateClient();
    private readonly SemaphoreSlim _lock = new(1,1);
    private AviationHazard[] _cached = [];
    private DateTimeOffset _updated = DateTimeOffset.MinValue;
    private DateTimeOffset _lastAttempt = DateTimeOffset.MinValue;
    private string? _error;

    private static HttpClient CreateClient()
    {
        var c = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri("https://aviationweather.gov/api/data/"),
            Timeout = TimeSpan.FromSeconds(12)
        };
        c.DefaultRequestHeaders.UserAgent.Add(new ProductInfoHeaderValue("MSFS-Companion","0.3"));
        return c;
    }

    public static AviationHazard[] ParseGeoJson(Stream stream)
    {
        using var json = JsonDocument.Parse(stream,new JsonDocumentOptions{MaxDepth=20});
        var root=json.RootElement;
        if (!root.TryGetProperty("features",out var features) || features.ValueKind!=JsonValueKind.Array)
            throw new InvalidDataException("Expected GeoJSON FeatureCollection.");
        var result=new List<AviationHazard>();
        foreach(var item in features.EnumerateArray().Take(500))
        {
            if (!item.TryGetProperty("geometry",out var geometry) ||
                geometry.ValueKind!=JsonValueKind.Object ||
                !geometry.TryGetProperty("type",out var type) ||
                type.ValueKind!=JsonValueKind.String ||
                !geometry.TryGetProperty("coordinates",out var coordinates) ||
                coordinates.ValueKind!=JsonValueKind.Array) continue;
            var kind=type.GetString();
            // Multipolygons and complex holes are not flattened incorrectly.
            if(kind!="Polygon")continue;
            var outer=coordinates.EnumerateArray().FirstOrDefault();
            if(outer.ValueKind!=JsonValueKind.Array)continue;
            var points=new List<HazardPoint>(100);
            foreach(var coord in outer.EnumerateArray().Take(101))
            {
                if(coord.ValueKind!=JsonValueKind.Array || coord.GetArrayLength()<2) {points.Clear();break;}
                var v=coord.EnumerateArray().Take(2).ToArray();
                if(!v[0].TryGetDouble(out var lon)||!v[1].TryGetDouble(out var lat)||
                    !double.IsFinite(lat)||!double.IsFinite(lon)||
                    Math.Abs(lat)>85.05||Math.Abs(lon)>180) {points.Clear();break;}
                points.Add(new HazardPoint(lat,lon));
            }
            if(points.Count<3 || points.Count>100)continue;
            string? description=null,from=null,to=null;
            if(item.TryGetProperty("properties",out var props) && props.ValueKind==JsonValueKind.Object)
            {
                description=ReadText(props,"rawSigmet")??ReadText(props,"hazard")??
                    ReadText(props,"phenomenon");
                from=ReadText(props,"validTimeFrom")??ReadText(props,"validFrom");
                to=ReadText(props,"validTimeTo")??ReadText(props,"validTo");
            }
            result.Add(new AviationHazard("SIGMET",
                description is {Length:>0} ? description : "SIGMET – bez popisu",
                points.ToArray(),from,to));
            if(result.Count>=120)break;
        }
        return result.ToArray();
    }

    private static string? ReadText(JsonElement props,string name)
    {
        if(!props.TryGetProperty(name,out var v)||v.ValueKind!=JsonValueKind.String)return null;
        var text=v.GetString();
        return text is null ? null : text[..Math.Min(text.Length,300)];
    }
    public async Task<object> NearbyAsync(double latitude,double longitude,double radiusKm,CancellationToken ct)
    {
        await _lock.WaitAsync(ct);
        try
        {
            var now=DateTimeOffset.UtcNow;
            if(now-_updated>TimeSpan.FromMinutes(10) &&
                now-_lastAttempt>TimeSpan.FromMinutes(2))
            {
                _lastAttempt=now;
                try
                {
                    using var reply=await Http.GetAsync("isigmet?format=geojson",
                        HttpCompletionOption.ResponseHeadersRead,ct);
                    AviationHazard[] hazards;
                    if(reply.StatusCode==HttpStatusCode.NoContent)hazards=[];
                    else
                    {
                        reply.EnsureSuccessStatusCode();
                        if(reply.Content.Headers.ContentLength is > 4_000_000)
                            throw new InvalidDataException("SIGMET response too large.");
                        await using var input=await reply.Content.ReadAsStreamAsync(ct);
                        using var memory=new MemoryStream();
                        var buffer=new byte[32768]; int count;
                        while((count=await input.ReadAsync(buffer,ct))!=0)
                        {
                            if(memory.Length+count>4_000_000)throw new InvalidDataException("SIGMET response too large.");
                            memory.Write(buffer,0,count);
                        }
                        memory.Position=0;
                        hazards=ParseGeoJson(memory);
                    }
                    _cached=hazards;_updated=DateTimeOffset.UtcNow;_error=null;
                }
                catch(OperationCanceledException) when(ct.IsCancellationRequested) {throw;}
                catch(Exception ex) when(ex is HttpRequestException or TaskCanceledException
                    or InvalidDataException or JsonException)
                {_error="Mezinárodní SIGMET není momentálně dostupný.";}
            }
            // Filter by approximate nearby bounding region; do not claim route intersection.
            var selected=_cached.Where(h=>h.Boundary.Any(p =>
                Math.Abs(p.Latitude-latitude)<=radiusKm/111.0 &&
                Math.Abs((((p.Longitude-longitude)+540)%360)-180)<=radiusKm/Math.Max(20,111*Math.Cos(latitude*Math.PI/180))))
                .Take(40).ToArray();
            return new {available=_updated!=DateTimeOffset.MinValue,
                stale=_updated!=DateTimeOffset.MinValue&&DateTimeOffset.UtcNow-_updated>TimeSpan.FromMinutes(20),
                updatedAt=_updated==DateTimeOffset.MinValue?(DateTimeOffset?)null:_updated,
                source="NOAA International SIGMET",error=_error,hazards=selected};
        }
        finally {_lock.Release();}
    }

    public static void Map(WebApplication app)
    {
        app.MapGet("/api/weather/hazards", async(double lat,double lon,double? radiusKm,
            AviationHazardsService service,CancellationToken ct)=>{
            var radius=radiusKm??180;
            if(!double.IsFinite(lat)||!double.IsFinite(lon)||Math.Abs(lat)>85.05||
               Math.Abs(lon)>180||!double.IsFinite(radius)||radius<20||radius>500)
                return Results.BadRequest(new{error="Neplatná oblast."});
            return Results.Ok(await service.NearbyAsync(lat,lon,radius,ct));
        });
    }
}
