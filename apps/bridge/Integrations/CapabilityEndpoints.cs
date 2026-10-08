using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Avionics;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Integrations;

public static class CapabilityEndpoints
{
    public static void MapCapabilityCatalog(this WebApplication app)
    {
        app.MapGet("/api/aircraft/capabilities", async (
            ITelemetrySource source, TelemetryHealth health, TelemetryStore store,
            G1000Service avionics, CancellationToken ct) =>
        {
            var connected = source.Mode == "simconnect" &&
                health.Snapshot(source.Mode).Connected;
            var aircraft = connected ? store.Current.Aircraft : null;
            var profile = AircraftProfileResolver.Resolve(aircraft);
            if (!connected)
                return Results.Ok(new { connected = false, profile,
                    status = "offline", entries = Array.Empty<CapabilityCatalog.Entry>() });

            var advanced = await avionics.StatusAdvancedAsync(ct);
            var g1000 = await avionics.StatusAsync(ct);
            var availableIds = advanced.AvailableActions.Concat(g1000.AvailableActions);
            var entries = CapabilityCatalog.ForAircraft(aircraft, availableIds);
            var assessment = CompatibilityAssessment.Evaluate(connected, aircraft,
                g1000, advanced, entries.Count(e => e.Enumerated), entries.Length,
                DateTimeOffset.UtcNow);
            return Results.Ok(new {
                connected, aircraft, profile, status = assessment.State,
                assessment, scannedAt = g1000.CheckedAt,
                g1000Status = g1000.Status, advancedStatus = advanced.Status,
                entries
            });
        });
    }
}
