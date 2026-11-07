using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Telemetry;

namespace MsfsCompanion.Bridge.Integrations;

/// <summary>
/// Read-only fixed-loopback health check for FlyByWire SimBridge web MCDU.
/// Does not proxy avionics, inspect the FMS, or send key commands.
/// </summary>
public static class FlyByWireIntegrationEndpoints
{
    private static readonly HttpClient Client = new(
        new HttpClientHandler { AllowAutoRedirect = false, UseProxy = false })
    {
        Timeout = TimeSpan.FromSeconds(2)
    };

    public static int ParsePort(string? text) =>
        int.TryParse(text, out var port) && port is >= 1024 and <= 65535
            ? port : 8380;

    public static bool IsA32nxCandidate(string? title) =>
        AircraftProfileResolver.Resolve(title).Id == "a320-fbw-a32nx-candidate";

    public static void MapFlyByWireIntegration(this WebApplication app)
    {
        app.MapGet("/api/integrations/flybywire", async (
            HttpContext ctx, AircraftIdentityGuard identity, ITelemetrySource source,
            TelemetryHealth health, TelemetryStore telemetry) =>
        {
            ctx.Response.Headers.CacheControl = "no-store";
            var now = DateTimeOffset.UtcNow;
            var live = source.Mode == "simconnect"
                && health.Snapshot(source.Mode).Connected
                && identity.Trusted(telemetry.Current.Aircraft, now);
            var aircraft = live ? identity.Current.Title : null;
            var matched = live && IsA32nxCandidate(aircraft);
            var port = ParsePort(Environment.GetEnvironmentVariable("MSFS_SIMBRIDGE_PORT"));
            var reachable = false;
            // Never accept a URL or host from the browser. No redirects,
            // system proxy, or response body buffering on an HTTP probe.
            if (matched && OperatingSystem.IsWindows())
            {
                try
                {
                    using var request = new HttpRequestMessage(HttpMethod.Get,
                        "http://127.0.0.1:" + port + "/interfaces/mcdu");
                    using var response = await Client.SendAsync(request,
                        HttpCompletionOption.ResponseHeadersRead, ctx.RequestAborted);
                    reachable = response.IsSuccessStatusCode;
                }
                catch (HttpRequestException) { }
                catch (TaskCanceledException) when (!ctx.RequestAborted.IsCancellationRequested) { }
            }
            return Results.Ok(new
            {
                aircraftMatched = matched,
                aircraft = matched ? aircraft : null,
                profileId = matched ? "a320-fbw-a32nx-candidate" : null,
                simBridgeReachable = reachable,
                checkedOnWindows = matched && OperatingSystem.IsWindows(),
                port,
                remoteMcduPath = "/interfaces/mcdu",
                fmsSyncVerified = false,
                mcduControlByCompanion = false,
                lastCheckedUtc = now,
                note = !matched
                    ? "A32NX není potvrzeno aktuálním SimConnect TITLE."
                    : reachable
                        ? "Web MCDU odpovídá; propojení s avionikou ověřte v MSFS."
                        : "SimBridge MCDU není dostupné na Windows localhost; ověřte instalaci a EFB."
            });
        });
    }
}
