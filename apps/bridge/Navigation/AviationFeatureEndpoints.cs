namespace MsfsCompanion.Bridge.Navigation;

/// <summary>Mapové API čte vlastní diskovou cache OurAirports; žádný externí program.</summary>
public static class AviationFeatureEndpoints
{
    public static void MapAviationFeatures(this WebApplication app)
    {
        app.MapGet("/api/map/aviation", (double lat, double lon, double? radiusKm,
            AviationCatalog catalog) =>
        {
            if (!double.IsFinite(lat) || !double.IsFinite(lon) ||
                Math.Abs(lat) > 85.05 || Math.Abs(lon) > 180 ||
                radiusKm is { } r && (!double.IsFinite(r) || r < 5 || r > 200))
                return Results.BadRequest(new { error = "Neplatné souřadnice nebo radiusKm (5–200)." });

            return Results.Ok(catalog.Nearby(lat, lon, radiusKm ?? 85));
        });

        app.MapGet("/api/map/aviation/search", (string? q, AviationCatalog catalog) =>
        {
            if (q is null || q.Length is < 2 or > 70)
                return Results.BadRequest(new { error = "Hledaný výraz musí mít 2–70 znaků." });
            return Results.Ok(catalog.Search(q));
        });

        app.MapGet("/api/map/aviation/airport/{ident}", (string ident, AviationCatalog catalog) =>
        {
            if (ident.Length is < 1 or > 24 ||
                ident.Any(c => !(char.IsAsciiLetterOrDigit(c) || c == '-')))
                return Results.BadRequest(new { error = "Neplatný ident letiště." });
            var detail = catalog.Airport(ident);
            return detail is null ? Results.NotFound() : Results.Ok(detail);
        });
    }
}
