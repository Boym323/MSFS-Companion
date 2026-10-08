using System.Diagnostics;
using SimConnect.NET;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Pouze čtení z MSFS přes jeden SimFrame subscription. Po ztrátě
/// spojení přestane publikovat stale data a zkusí se připojit znovu.
/// Žádné SimConnect Set/Transmit/Execute API se nepoužívá.
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

        logger.LogInformation("Startuji živé čtení SimConnect (nejvýše 20 Hz do dashboardu).");
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
                logger.LogWarning(ex, "SimConnect není dostupný nebo se přerušilo spojení. Zkusím další pokus.");
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
            logger.LogDebug(ex, "Nepodařilo se přečíst TITLE, používám obecný název letadla.");
        }

        long lastSentTicks = 0;
        long lastReceivedTicks = 0;
        int invalidPackets = 0;

        // SimConnect posílá jeden strukturovaný vzorek každým sim frame.
        // Kvůli omezení zátěže pustíme do TelemetryStore maximálně 20 Hz.
        using var subscription = client.SimVars.Subscribe<SimConnectAircraftData>(
            SimConnectPeriod.SimFrame,
            value =>
            {
                var now = Stopwatch.GetTimestamp();
                Interlocked.Exchange(ref lastReceivedTicks, now);
                if (!value.IsValid())
                {
                    if (Interlocked.Increment(ref invalidPackets) == 1)
                        logger.LogWarning("SimConnect poslal neplatná telemetrická data; vzorek zahazuji.");
                    return;
                }

                // Odběr nesmí blokovat callback nativní knihovny.
                var previous = Interlocked.Read(ref lastSentTicks);
                if (previous != 0 && Stopwatch.GetElapsedTime(previous, now) < TimeSpan.FromMilliseconds(50))
                    return;

                if (Interlocked.CompareExchange(ref lastSentTicks, now, previous) != previous)
                    return;

                var timestamp = DateTimeOffset.UtcNow;
                store.Update(value.ToSnapshot(aircraft, timestamp));
                health.AcceptSample(timestamp);
            },
            cancellationToken: stoppingToken);

        logger.LogInformation("SimConnect subscription aktivní. Čekám na letová data.");
        var connectedAt = Stopwatch.GetTimestamp();
        while (!stoppingToken.IsCancellationRequested)
        {
            if (!client.IsConnected)
                throw new IOException("SimConnect se odpojil.");

            if (subscription.Completion.IsCompleted)
            {
                await subscription.Completion;
                throw new IOException("Odběr SimConnect skončil.");
            }

            var last = Interlocked.Read(ref lastReceivedTicks);
            var age = Stopwatch.GetElapsedTime(last == 0 ? connectedAt : last);
            if (age > TimeSpan.FromSeconds(last == 0 ? 12 : 6))
                throw new TimeoutException("SimConnect neposílá aktuální snímky (pauza nebo výpadek).");

            await Task.Delay(500, stoppingToken);
        }
    }
}
