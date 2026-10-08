using System.Net.WebSockets;
using System.Text.Json;
using MsfsCompanion.Bridge.Telemetry;
using MsfsCompanion.Bridge.Admin;
using MsfsCompanion.Bridge.Controls;
using MsfsCompanion.Bridge.Avionics;
using MsfsCompanion.Bridge.Recorder;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<TelemetryStore>();
builder.Services.AddSingleton<TelemetryHealth>();
builder.Services.AddSingleton<AircraftSystemsStore>();
builder.Services.AddSingleton<RadioStore>();
builder.Services.AddSingleton<AutopilotModesStore>();
builder.Services.AddSingleton<ControlAccess>();
builder.Services.AddSingleton<NativeCockpitEventSender>();
builder.Services.AddSingleton<G1000Service>();

// Windows instalátor nastavuje live režim. Samostatný vývojový server
// zůstává v mock režimu, pokud není režim explicitně vyžádán.
var telemetryMode = Environment.GetEnvironmentVariable("MSFS_COMPANION_TELEMETRY_MODE");
if (string.Equals(telemetryMode, "simconnect", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<SimConnectTelemetrySource>();
    builder.Services.AddSingleton<ITelemetrySource>(
        provider => provider.GetRequiredService<SimConnectTelemetrySource>());
    builder.Services.AddHostedService(
        provider => provider.GetRequiredService<SimConnectTelemetrySource>());
}
else
{
    builder.Services.AddSingleton<MockTelemetrySource>();
    builder.Services.AddSingleton<ITelemetrySource>(
        provider => provider.GetRequiredService<MockTelemetrySource>());
    builder.Services.AddHostedService(
        provider => provider.GetRequiredService<MockTelemetrySource>());
}

builder.Services.AddSingleton<FlightRecorder>();
builder.Services.AddHostedService(p => p.GetRequiredService<FlightRecorder>());

var app = builder.Build();

// Kontrola všech příchozích spojení včetně HTML, API a WebSocketu.
// Zamezuje přístupu z jiných podsítí i DNS rebindingu.
app.Use(async (context, next) =>
{
    if (!LanRequestPolicy.Allows(context))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    await next(context);
});

// The Windows installer bundles the Vite production build into wwwroot.
// Vite development continues to proxy requests from port 5173 as before.
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(20)
});

app.MapGet("/api/status", (ITelemetrySource source, TelemetryHealth health) =>
{
    var telemetry = health.Snapshot(source.Mode);
    return Results.Ok(new
    {
        status = "ok",
        simulator = telemetry.Mode,
        mode = telemetry.Mode,
        connected = telemetry.Connected,
        connectionState = telemetry.ConnectionState,
        lastTelemetryUtc = telemetry.LastTelemetryUtc,
        sampleAgeMs = telemetry.SampleAgeMs,
        sampleRateHz = telemetry.SampleRateHz,
        samplesReceived = telemetry.SamplesReceived,
        connectionAttempts = telemetry.ConnectionAttempts,
        lastError = telemetry.LastError,
        incomingRateHz = telemetry.IncomingRateHz,
        samplesPublished = telemetry.SamplesPublished,
        framesSkipped = telemetry.FramesSkipped,
        publicationLagMs = telemetry.PublicationLagMs
    });
});

app.MapGet("/api/telemetry", (TelemetryStore store) =>
    Results.Ok(store.Current));

// Oddělené 1Hz systémové údaje (pouze čtení, bez kokpitových příkazů).
app.MapGet("/api/aircraft/systems", (AircraftSystemsStore systemsStore) =>
    Results.Ok(systemsStore.Status()));

// C1: radio readback bez oprávnění k zápisu.
app.MapGet("/api/radios", (RadioStore radios) => Results.Ok(radios.Status()));
app.MapGet("/api/autopilot/modes", (AutopilotModesStore modes) => Results.Ok(modes.Status()));

// Ovládání je po startu vypnuté, aktivuje se jen na loopbacku.
app.MapCockpitControls();
app.MapG1000();

// Pouze čtení. Záznam probíhá na Windows i bez otevřeného prohlížeče.
app.MapGet("/api/flights", (FlightRecorder recorder) =>
    Results.Ok(recorder.List()));
app.MapGet("/api/flights/{id}", (string id, FlightRecorder recorder) =>
{
    var flight = recorder.Read(id);
    return flight is null ? Results.NotFound() : Results.Ok(flight);
});

// Správa aktualizací je dostupná pouze ve Windows hostiteli a v LAN.
// POST vyžaduje kontrolu původu požadavku, nikoli uživatelský klíč.
app.MapAdminUpdates();

// Read-only telemetry stream. Cockpit commands require a separately
// authenticated, allow-listed API and are deliberately not exposed yet.
app.Map("/ws", async (HttpContext context, TelemetryStore store) =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(50));
    var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
    DateTimeOffset? lastSentTimestamp = null;

    try
    {
        while (socket.State == WebSocketState.Open
               && await timer.WaitForNextTickAsync(context.RequestAborted))
        {
            var snapshot = store.Current;
            // Timer samotný nesmí vytvářet falešných 20 Hz ze starého snímku.
            if (lastSentTimestamp == snapshot.TimestampUtc)
                continue;

            lastSentTimestamp = snapshot.TimestampUtc;
            var message = JsonSerializer.SerializeToUtf8Bytes(snapshot, jsonOptions);
            await socket.SendAsync(
                message,
                WebSocketMessageType.Text,
                endOfMessage: true,
                cancellationToken: context.RequestAborted);
        }
    }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
    {
        // Browser disconnected or the application is stopping.
    }
    catch (WebSocketException)
    {
        // Browser disconnected unexpectedly. Reconnection is handled by the UI.
    }
});

// Reject unknown API paths instead of routing them to the SPA fallback.
// This also keeps unauthenticated cockpit-control endpoints unavailable.
app.Map("/api/{**unmatched}", () => Results.NotFound());
app.Map("/api", () => Results.NotFound());

// Unknown frontend routes use the bundled React entry point.
app.MapFallbackToFile("index.html");

app.Run();
