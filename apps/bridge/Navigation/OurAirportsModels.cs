using System.Globalization;
using Microsoft.VisualBasic.FileIO;

namespace MsfsCompanion.Bridge.Navigation;

public sealed record AirportData(string Ident, string Name, string AirportType,
    double Latitude, double Longitude, double? ElevationFeet);
public sealed record RunwayData(string AirportIdent, string LowIdent, string HighIdent,
    double Latitude, double Longitude, double EndLatitude, double EndLongitude,
    double? LengthFeet, string Surface);
public sealed record NavaidData(string Ident, string Name, string Type,
    double Latitude, double Longitude, double? FrequencyKhz);
public sealed record FrequencyData(string AirportIdent, string Type, string Description, double FrequencyMhz);

public sealed record AviationCatalogSnapshot(
    DateTimeOffset UpdatedAt,
    AirportData[] Airports, RunwayData[] Runways, NavaidData[] Navaids,
    FrequencyData[] Frequencies);

public sealed record AviationFeature(
    string Type, string Ident, string Name, double Latitude, double Longitude,
    double? EndLatitude = null, double? EndLongitude = null,
    string? AirportIdent = null, double? LengthFeet = null, string? Surface = null,
    double? FrequencyKhz = null);

/// <summary>
/// Čte původní CSV soubory OurAirports včetně uvozovek, escapovaných čárek
/// a případných víceřádkových textových polí. Bez externího CSV balíčku.
/// </summary>
public static class OurAirportsCsv
{
    public static AirportData[] Airports(string csv) =>
        Parse(csv, row =>
        {
            var type = row.Get("type");
            if (type is "closed" or "") return null;
            if (!row.Position("latitude_deg", "longitude_deg", out var lat, out var lon))
                return null;
            var id = row.Get("ident", 24);
            return id.Length == 0 ? null : new AirportData(id, row.Get("name", 100),
                type, lat, lon, row.Double("elevation_ft"));
        }, 110_000);

    public static RunwayData[] Runways(string csv) =>
        Parse(csv, row =>
        {
            if (row.Get("closed") == "1" ||
                !row.Position("le_latitude_deg", "le_longitude_deg", out var lat, out var lon) ||
                !row.Position("he_latitude_deg", "he_longitude_deg", out var endLat, out var endLon))
                return null;
            var airport = row.Get("airport_ident", 24);
            return airport.Length == 0 ? null : new RunwayData(airport, row.Get("le_ident", 16),
                row.Get("he_ident", 16), lat, lon, endLat, endLon,
                row.Double("length_ft"), row.Get("surface", 32));
        }, 120_000);

    public static NavaidData[] Navaids(string csv) =>
        Parse(csv, row =>
        {
            var kind = row.Get("type");
            var type = kind.StartsWith("VOR", StringComparison.OrdinalIgnoreCase) ||
                       kind == "VORTAC" ? "vor" :
                       kind.StartsWith("NDB", StringComparison.OrdinalIgnoreCase) ? "ndb" :
                       kind is "DME" or "TACAN" ? "dme" : null;
            if (type is null || !row.Position("latitude_deg", "longitude_deg", out var lat, out var lon))
                return null;
            var id = row.Get("ident", 24);
            return id.Length == 0 ? null : new NavaidData(id, row.Get("name", 100),
                type, lat, lon, row.Double("frequency_khz"));
        }, 75_000);

    public static FrequencyData[] Frequencies(string csv) =>
        Parse(csv, row =>
        {
            var airport = row.Get("airport_ident", 24);
            var mhz = row.Double("frequency_mhz");
            if (airport.Length == 0 || mhz is not >= 100 or > 150)
                return null;
            return new FrequencyData(airport, row.Get("type", 24),
                row.Get("description", 90), mhz.Value);
        }, 120_000);

    private static T[] Parse<T>(string csv, Func<CsvRow, T?> convert, int maxRows) where T : class
    {
        using var reader = new StringReader(csv);
        using var parser = new TextFieldParser(reader)
        {
            TextFieldType = FieldType.Delimited,
            HasFieldsEnclosedInQuotes = true,
            TrimWhiteSpace = true
        };
        parser.SetDelimiters(",");
        var header = parser.ReadFields() ?? throw new InvalidDataException("Prázdný CSV dataset.");
        var columns = header.Select((name, index) => (name, index))
            .ToDictionary(pair => pair.name.TrimStart('\uFEFF'), pair => pair.index,
                StringComparer.OrdinalIgnoreCase);
        var result = new List<T>();
        var scanned = 0;
        while (!parser.EndOfData)
        {
            if (++scanned > maxRows)
                throw new InvalidDataException("OurAirports CSV překročilo očekávaný počet řádků.");
            var fields = parser.ReadFields();
            if (fields is null) continue;
            var item = convert(new CsvRow(columns, fields));
            if (item is not null) result.Add(item);
        }
        return result.ToArray();
    }

    public readonly record struct CsvRow(
        Dictionary<string, int> Columns, string[] Fields)
    {
        public string Get(string column, int limit = 80)
        {
            if (!Columns.TryGetValue(column, out var index) || index >= Fields.Length)
                return "";
            var value = Fields[index].Trim();
            if (value.Length > limit) value = value[..limit];
            return new string(value.Where(c => !char.IsControl(c)).ToArray());
        }
        public double? Double(string column)
        {
            if (!Columns.TryGetValue(column, out var index) || index >= Fields.Length)
                return null;
            if (!double.TryParse(Fields[index], NumberStyles.Float,
                CultureInfo.InvariantCulture, out var value) || !double.IsFinite(value))
                return null;
            return value;
        }
        public bool Position(string latColumn, string lonColumn,
            out double lat, out double lon)
        {
            lat = Double(latColumn) ?? double.NaN;
            lon = Double(lonColumn) ?? double.NaN;
            return double.IsFinite(lat) && double.IsFinite(lon)
                && Math.Abs(lat) <= 85.05 && Math.Abs(lon) <= 180;
        }
    }
}
