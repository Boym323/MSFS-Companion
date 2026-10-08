using System.Diagnostics;
using SimConnect.NET;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Pouze čtení z MSFS. Callback přijímá každý validní SimFrame; nezávislý
/// 20Hz publisher vybírá nejnovější NEPOUŽITÝ snímek ze slotu.
/// Při výpadku se nepřechází na mock a obnovuje se spojení.
/// </summary>
public sealed class SimConnectTelemetrySource(
    TelemetryStore store,
    TelemetryHealth health,
    ILogger<SimConnectTelemetrySource> logger) : BackgroundService, ITelemetrySource
{
    public string Mode => "simconnect";

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!OperatingSystem.IsWindows())
        {
            health.SetWaiting("SimConnect vyžaduje Windows.");
            logger.LogError("SimConnect telemetrie je dostupná pouze na Windows.");
            return;
        }

        logger.LogInformation("SimConnect příjem každým sim frame, předávání do webu maximálně 20 Hz.");
        while (!stoppingToken.IsCancellationRequested)
        {
            health.StartConnecting();
            store.Reset("Čekám na MSFS 2020");
            try
            {
                await ReadUntilDisconnectedAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "SimConnect není dostupný nebo se přerušilo spojení.");
                health.SetWaiting($"{ex.GetType().Name}: {ex.Message}");
            }

            store.Reset("MSFS není připojen");
            if (stoppingToken.IsCancellationRequested)
                break;

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ReadUntilDisconnectedAsync(CancellationToken stoppingToken)
    {
        await using var client = new SimConnectClient("MSFS Companion – živá telemetrie")
        {
            AutoReconnectEnabled = false
        };

        using (var timeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken))
        {
            timeout.CancelAfter(TimeSpan.FromSeconds(10));
            await client.ConnectAsync(cancellationToken: timeout.Token);
        }

        if (client.IsMSFS2024)
            logger.LogWarning("Zjištěn MSFS 2024; tato etapa je ověřována primárně na MSFS 2020.");

        var aircraft = "Letadlo MSFS (SimConnect)";
        try
        {
            using var titleTimeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            titleTimeout.CancelAfter(TimeSpan.FromSeconds(3));
            var title = await client.SimVars.GetAsync<string>("TITLE", "", cancellationToken: titleTimeout.Token);
            if (!string.IsNullOrWhiteSpace(title))
                aircraft = title.Trim();
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Nepodařilo se přečíst TITLE.");
        }

        var buffer = new LatestFrameBuffer<SimConnectAircraftData>();
        var firstReceivedAt = Stopwatch.GetTimestamp();
        var invalidPackets = 0;

        // Callback nikdy nečeká na publikační časovač. Počítá VŠECHNY
        // platné snímky ze simulátoru, včetně záměrně přeskočených.
        using var subscription = client.SimVars.Subscribe<SimConnectAircraftData>(
            SimConnectPeriod.SimFrame,
            value =>
            {
                if (!value.IsValid())
                {
                    if (Interlocked.Increment(ref invalidPackets) == 1)
                        logger.LogWarning("SimConnect poslal neplatný snímek; ignoruji ho.");
                    return;
                }

                var receivedTicks = Stopwatch.GetTimestamp();
                var receivedUtc = DateTimeOffset.UtcNow;
                buffer.Write(value, receivedUtc, receivedTicks);
                health.RecordIncoming(receivedUtc);
            },
            cancellationToken: stoppingToken);

        logger.LogInformation("SimConnect subscription aktivní; publisher poběží na 20 Hz.");
        long lastPublishedSequence = 0;
        using var publishTimer = new PeriodicTimer(TimeSpan.FromMilliseconds(50));
        while (!stoppingToken.IsCancellationRequested
               && await publishTimer.WaitForNextTickAsync(stoppingToken))
        {
            if (!client.IsConnected)
                throw new IOException("SimConnect se odpojil.");

            if (subscription.Completion.IsCompleted)
            {
                await subscription.Completion;
                throw new IOException("Odběr SimConnect skončil.");
            }

            // Watchdog sleduje příchozí validní vzorky, nikoli timer nebo
            // poslední odeslání do WebSocketu. Neplatné hodnoty jej neudrží naživu.
            var lastReceived = buffer.LastReceivedTicks;
            var age = Stopwatch.GetElapsedTime(lastReceived == 0 ? firstReceivedAt : lastReceived);
            if (age > TimeSpan.FromSeconds(lastReceived == 0 ? 12 : 6))
                throw new TimeoutException("SimConnect neposílá aktuální platné snímky.");

            var previousSequence = lastPublishedSequence;
            if (!buffer.TryReadNew(ref lastPublishedSequence, out var frame) || frame is null)
                continue; // žádné opakované publikování starých hodnot

            // Počet záměrně přeskočených snímků (30 Hz -> 20 Hz).
            var skipped = Math.Max(0, frame.Sequence - previousSequence - 1);

            store.Update(frame.Data.ToSnapshot(aircraft, frame.ReceivedUtc));
            health.RecordPublished(frame.ReceivedUtc, DateTimeOffset.UtcNow, skipped);
        }
    }

}
