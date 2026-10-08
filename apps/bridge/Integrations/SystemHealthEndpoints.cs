using MsfsCompanion.Bridge.Navigation;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Integrations;

public static class SystemHealthEndpoints
{
    public sealed record HealthIndicator(string Id, string Label, string State,
        string Detail);
    public static HealthIndicator AssessTelemetry(TelemetryDiagnostics sample) =>
        sample.Mode == "mock"
            ? new("simconnect","SimConnect","test","Vývojový mock; nejde o živá data MSFS.")
            : sample.Connected
                ? new("simconnect","SimConnect","ok",
                    $"Příjem {sample.IncomingRateHz:F1} Hz, publikace {sample.SampleRateHz:F1} Hz, zpoždění {sample.PublicationLagMs?.ToString("F0") ?? "—"} ms")
                : new("simconnect","SimConnect","warning",
                    $"Stav: {sample.ConnectionState}. Poslední platný vzorek chybí.");

    public static void MapHealth(this WebApplication app)
    {
        app.MapGet("/api/health/overview", (ITelemetrySource source,
            TelemetryHealth health, AircraftSystemsStore systems,
            RadioStore radios, NavigationStore nav, AviationCatalog aviation,
            AviationWeatherService weather, VatsimService vatsim) =>
        {
            var sample = health.Snapshot(source.Mode);
            var snapshot = systems.Current;
            var systemsFresh = sample.Connected && snapshot is not null &&
                DateTimeOffset.UtcNow - snapshot.TimestampUtc < TimeSpan.FromSeconds(10);
            var mdns = Environment.GetEnvironmentVariable("MSFS_COMPANION_MDNS_NAME");
            var indicators = new[] {
                AssessTelemetry(sample),
                new HealthIndicator("systems","Systémové SimVars",
                    systemsFresh ? "ok" : "unknown",
                    systemsFresh ? "Vzorek systémů je aktuální." : "Není potvrzen čerstvý vzorek systémů."),
                new HealthIndicator("mdns","mDNS",
                    string.IsNullOrWhiteSpace(mdns) ? "unknown" : "configured",
                    string.IsNullOrWhiteSpace(mdns)
                        ? "Není oznámen hostname; stav Windows mDNS inzerce nelze z bridge ověřit."
                        : "Bridge přijímá nakonfigurovaný hostname; multicast UDP 5353 není testován.")
            };
            return Results.Ok(new {
                generatedAt = DateTimeOffset.UtcNow,
                sample,
                indicators,
                aviation = aviation.CacheHealth(),
                weather = weather.CacheHealth(),
                vatsim = vatsim.CacheHealth(),
                // Read-only status, no hidden connections or scans.
                radio = radios.Status(),
                navigation = nav.Status()
            });
        });
    }
}
