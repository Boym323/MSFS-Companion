using MsfsCompanion.Bridge.Integrations;
using System.Text;
var json = """
{"type":"FeatureCollection","features":[
 {"type":"Feature","properties":{"hazard":"TURB","validTimeFrom":"2026-10-08T12:00Z"},
  "geometry":{"type":"Polygon","coordinates":[[[14,50],[15,50],[14,51],[14,50]]]}},
 {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[1400,50],[15,50],[14,51]]]}}
]}
""";
using var stream = new MemoryStream(Encoding.UTF8.GetBytes(json));
var data=AviationHazardsService.ParseGeoJson(stream);
if(data.Length!=1||data[0].Boundary.Length!=4||
   data[0].Boundary[0].Latitude!=50||data[0].Boundary[0].Longitude!=14||
   data[0].Description!="TURB")
    throw new Exception("C21 SIGMET GeoJSON validation mismatch");
Console.WriteLine("PASS C21: only valid NOAA Polygon geometries are mapped");
