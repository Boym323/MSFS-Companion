using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Integrations;

public static class CapabilityEndpoints
{
    /// <summary>
    /// No additional SimConnect instance or Input Events enumeration.
    /// A trusted TITLE is only a candidate classifier, never FMS verification.
    /// </summary>
    public static void MapCapabilityCatalog(this WebApplication app)
    {
        app.MapGet("/api/aircraft/capabilities", (HttpContext ctx,
            ITelemetrySource source, TelemetryHealth health, TelemetryStore store,
            AircraftIdentityGuard identity) =>
        {
            ctx.Response.Headers.CacheControl="no-store";
            var trusted=source.Mode=="simconnect"&&
                health.Snapshot(source.Mode).Connected&&
                identity.Trusted(store.Current.Aircraft,DateTimeOffset.UtcNow);
            var title=trusted?identity.Current.Title:null;
            var assessment=CompatibilityAssessment.Evaluate(trusted,title);
            return Results.Ok(new {
                connected=trusted, aircraft=title,
                profile=AircraftProfileResolver.Resolve(title),
                status=assessment.State,assessment,
                entries=Array.Empty<object>(),
                scannedAt=(DateTimeOffset?)null
            });
        });
    }

    /// <summary>Retired command routes fail closed, including requests to old bookmarks.</summary>
    public static void MapDeprecatedAvionics(this WebApplication app)
    {
        app.MapGet("/api/avionics/g1000",()=>Results.StatusCode(410));
        app.MapPost("/api/avionics/g1000/command",()=>Results.StatusCode(410));
        app.MapGet("/api/avionics/advanced",()=>Results.StatusCode(410));
        app.MapPost("/api/avionics/advanced/command",()=>Results.StatusCode(410));
    }
}
