using System.Diagnostics;

namespace MsfsCompanion.Bridge.Telemetry;

public sealed class MockTelemetrySource(
    TelemetryStore store,
    TelemetryHealth health,
    ILogger<MockTelemetrySource> logger) : BackgroundService, ITelemetrySource
{
    public string Mode => "mock";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Mock telemetry started at 20 Hz");
        var clock = Stopwatch.StartNew();
        using var timer = new PeriodicTimer(TimeSpan.FromMilliseconds(50));

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                var t = clock.Elapsed.TotalSeconds;
                var heading = (270 + t * 0.25) % 360;

                var at = DateTimeOffset.UtcNow;
                store.Update(new TelemetrySnapshot(
                    TimestampUtc: at,
                    Aircraft: "Cessna 172 (mock)",
                    Latitude: 50.1008 + 0.002 * Math.Sin(t / 60),
                    Longitude: 14.2600 + 0.005 * Math.Cos(t / 60),
                    AirspeedKnots: 115 + 9 * Math.Sin(t / 14),
                    AltitudeFeet: 4500 + 220 * Math.Sin(t / 20),
                    VerticalSpeedFeetPerMinute: 660 * Math.Cos(t / 20),
                    HeadingDegrees: heading,
                    PitchDegrees: 2.5 * Math.Sin(t / 7),
                    BankDegrees: 12 * Math.Sin(t / 11)
                ));
                health.AcceptSample(at);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown.
        }
    }
}
