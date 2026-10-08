using System.Net.WebSockets;
using System.Text.Json;
using MsfsCompanion.Bridge.Telemetry;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<TelemetryStore>();
builder.Services.AddSingleton<MockTelemetrySource>();
builder.Services.AddSingleton<ITelemetrySource>(
    provider => provider.GetRequiredService<MockTelemetrySource>());
builder.Services.AddHostedService(
    provider => provider.GetRequiredService<MockTelemetrySource>());

var app = builder.Build();
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(20)
});

app.MapGet("/api/status", (ITelemetrySource source, TelemetryStore store) =>
    Results.Ok(new
    {
        status = "ok",
        simulator = "mock",
        mode = source.Mode,
        connected = true,
        lastTelemetryUtc = store.Current.TimestampUtc
    }));

app.MapGet("/api/telemetry", (TelemetryStore store) =>
    Results.Ok(store.Current));

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

    try
    {
        while (socket.State == WebSocketState.Open
               && await timer.WaitForNextTickAsync(context.RequestAborted))
        {
            var message = JsonSerializer.SerializeToUtf8Bytes(
                store.Current, jsonOptions);
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

app.Run();
