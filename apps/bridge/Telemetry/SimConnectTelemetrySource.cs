using System.Diagnostics;
using SimConnect.NET;
using SimConnect.NET.SimVar;
using MsfsCompanion.Bridge.Navigation;
using MsfsCompanion.Bridge.Aircraft;
using MsfsCompanion.Bridge.Airbus;

namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Pouze čtení z MSFS. Callback přijímá každý validní SimFrame; nezávislý
/// 20Hz publisher vybírá nejnovější NEPOUŽITÝ snímek ze slotu.
/// Při výpadku se nepřechází na mock a obnovuje se spojení.
/// </summary>
public sealed class SimConnectTelemetrySource(
    TelemetryStore store,
    TelemetryHealth health,
    AircraftSystemsStore systemsStore,
    RadioStore radioStore,
    AutopilotModesStore autopilotModes,
    NavigationStore navigationStore,
    CockpitSystemsStore cockpitSystems,
    LandingStore landings,
    AircraftIdentityGuard identity,
    A320ReadbackStore a320,
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
        var consecutiveFailures = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            health.StartConnecting();
            identity.Reset();
            a320.Reset();
            systemsStore.Reset();
            radioStore.Reset();
            autopilotModes.Reset();
            navigationStore.Reset();
            cockpitSystems.Reset();
            landings.Reset();
            store.Reset("Čekám na MSFS 2020");
            var deliveredLiveData = false;
            try
            {
                await ReadUntilDisconnectedAsync(stoppingToken, () => deliveredLiveData = true);
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

            identity.Reset();
            a320.Reset();
            systemsStore.Reset();
            radioStore.Reset();
            autopilotModes.Reset();
            navigationStore.Reset();
            cockpitSystems.Reset();
            landings.Reset();
            store.Reset("MSFS není připojen");
            if (stoppingToken.IsCancellationRequested)
                break;

            try
            {
                consecutiveFailures = deliveredLiveData ? 0 : Math.Min(5, consecutiveFailures + 1);
                var wait = SimConnectRetryPolicy.DelayAfter(consecutiveFailures);
                logger.LogInformation("Další pokus o připojení SimConnect za {Seconds} s.",wait.TotalSeconds);
                await Task.Delay(wait, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task ReadUntilDisconnectedAsync(CancellationToken stoppingToken, Action markLive)
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

        string? aircraftTitle = null;
        try
        {
            using var titleTimeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            titleTimeout.CancelAfter(TimeSpan.FromSeconds(3));
            var title = await client.SimVars.GetAsync<SimConnectAircraftTitleData>(
                cancellationToken: titleTimeout.Token);
            if (!string.IsNullOrWhiteSpace(title.Title))
                aircraftTitle = title.Title.Trim();
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Nepodařilo se přečíst TITLE.");
        }

        // The display placeholder is NOT an authoritative identity. A slow
        // one-shot read must not trigger a false aircraft-change reconnect.
        identity.Begin(aircraftTitle,DateTimeOffset.UtcNow);

        // TITLE is optional for the read-only PFD, but mandatory for controls.
        // A failed TITLE subscription is retried independently instead of
        // tearing down a healthy 20Hz flight telemetry session.
        ISimVarSubscription? SubscribeTitle()
        {
            try
            {
                return client.SimVars.Subscribe<SimConnectAircraftTitleData>(
                    SimConnectPeriod.Second,
                    value=>identity.Observe(value.Title,DateTimeOffset.UtcNow),
                    cancellationToken:stoppingToken);
            }
            catch (Exception ex)
            {
                identity.MarkUnavailable();
                logger.LogWarning(ex,
                    "TITLE subscription unavailable; controls disabled, PFD remains live.");
                return null;
            }
        }

        ISimVarSubscription? titleSubscription=SubscribeTitle();
        var nextTitleRetryAt=DateTimeOffset.UtcNow.AddSeconds(5);

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

        using var systemsSubscription = SubscribeSystems(client, stoppingToken);
        using var radioSubscription = SubscribeRadios(client, stoppingToken);
        using var xpdrSubscription = SubscribeTransponder(client, stoppingToken);
        using var apModesSubscription = SubscribeAutopilotModes(client, stoppingToken);
        using var navSubscription = SubscribeNavigation(client, stoppingToken);
        using var waypointIdSubscription = SubscribeWaypointId(client, stoppingToken);
        using var cockpitSystemsSubscription = SubscribeCockpitSystems(client, stoppingToken);
        using var landingSubscription = SubscribeLanding(client, stoppingToken);
        // Optional readbacks may start after a late first TITLE, without
        // forcing a new SimConnect connection or losing the base PFD.
        ISimVarSubscription? a320EngineSubscription=null;
        ISimVarSubscription? a320FcuSubscription=null;
        ISimVarSubscription? a320AuxSubscription=null;
        var a320SubscriptionsAttempted=false;
        void EnsureAirbusSubscriptions(DateTimeOffset now)
        {
            if (a320SubscriptionsAttempted) return;
            var title=identity.Current.Title;
            if (!identity.Trusted(title,now) ||
                AircraftProfileResolver.Resolve(title).Id!="a320-asobo-candidate")
                return;

            a320SubscriptionsAttempted=true;
            a320EngineSubscription=SubscribeA320Engines(client,stoppingToken);
            a320FcuSubscription=SubscribeA320Fcu(client,stoppingToken);
            a320AuxSubscription=SubscribeA320Aux(client,stoppingToken);
        }

        logger.LogInformation("SimConnect subscription aktivní; publisher poběží na 20 Hz.");
        long lastPublishedSequence = 0;
        using var publishTimer = new PeriodicTimer(TimeSpan.FromMilliseconds(50));
        try
        {
            while (!stoppingToken.IsCancellationRequested
                   && await publishTimer.WaitForNextTickAsync(stoppingToken))
            {
                if (!client.IsConnected)
                    throw new IOException("SimConnect se odpojil.");
                // Only a CONFIRMED different TITLE needs fresh aircraft-specific
                // subscriptions. Stale/missing metadata only disables controls.
                if (identity.RequiresReconnect)
                    throw new IOException("Letadlo bylo změněno; obnovuji SimConnect subscriptions.");

                var now=DateTimeOffset.UtcNow;
                if (titleSubscription is not null && titleSubscription.Completion.IsCompleted)
                {
                    try { await titleSubscription.Completion; }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex,"TITLE subscription ended unexpectedly.");
                    }
                    titleSubscription.Dispose();
                    titleSubscription=null;
                    identity.MarkUnavailable();
                    nextTitleRetryAt=now.AddSeconds(5);
                    logger.LogWarning(
                        "TITLE reader stopped; commands blocked, flight telemetry remains connected.");
                }
                if (titleSubscription is null && now>=nextTitleRetryAt)
                {
                    titleSubscription=SubscribeTitle();
                    nextTitleRetryAt=now.AddSeconds(5);
                }

                EnsureAirbusSubscriptions(now);
                if (subscription.Completion.IsCompleted)
                {
                    await subscription.Completion;
                    throw new IOException("Odběr SimConnect skončil.");
                }

                // The base watchdog only depends on valid flight SimFrames.
                var lastReceived = buffer.LastReceivedTicks;
                var age = Stopwatch.GetElapsedTime(lastReceived == 0 ? firstReceivedAt : lastReceived);
                if (age > TimeSpan.FromSeconds(lastReceived == 0 ? 12 : 6))
                    throw new TimeoutException("SimConnect neposílá aktuální platné snímky.");

                var previousSequence = lastPublishedSequence;
                if (!buffer.TryReadNew(ref lastPublishedSequence, out var frame) || frame is null)
                    continue; // no republishing stale samples

                var skipped = Math.Max(0, frame.Sequence - previousSequence - 1);
                store.Update(frame.Data.ToSnapshot(
                    identity.Current.Title ?? "Letadlo MSFS (SimConnect)", frame.ReceivedUtc));
                markLive();
                health.RecordPublished(frame.ReceivedUtc,DateTimeOffset.UtcNow,skipped);
            }
        }
        finally
        {
            titleSubscription?.Dispose();
            a320EngineSubscription?.Dispose();
            a320FcuSubscription?.Dispose();
            a320AuxSubscription?.Dispose();
        }
    }

    private ISimVarSubscription? SubscribeLanding(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<SimConnectLandingData>(
                SimConnectPeriod.Second,
                data =>
                {
                    var system = systemsStore.Current;
                    var ground = system is not null && (DateTimeOffset.UtcNow - system.TimestampUtc).TotalSeconds < 3
                        ? system.OnGround : (bool?)null;
                    landings.Update(data, DateTimeOffset.UtcNow, ground);
                }, cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Touchdown SimVars nejsou dostupné.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeCockpitSystems(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<SimConnectCockpitSystemsData>(
                SimConnectPeriod.Second,
                value => cockpitSystems.Update(value, DateTimeOffset.UtcNow),
                cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Další kokpitní systémy nejsou dostupné.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeNavigation(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<SimConnectNavigationData>(
                SimConnectPeriod.Second,
                data =>
                {
                    if (data.IsValid())
                        navigationStore.Update(data, DateTimeOffset.UtcNow);
                }, cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "GPS telemetry unavailable; PFD remains running.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeWaypointId(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<string>("GPS WP NEXT ID", "string",
                SimConnectPeriod.Second,
                name => navigationStore.UpdateName(name, DateTimeOffset.UtcNow),
                cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Waypoint ID unavailable, coordinates remain supported.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeAutopilotModes(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<SimConnectAutopilotModesData>(
                SimConnectPeriod.Second,
                data =>
                {
                    if (data.IsValid())
                        autopilotModes.Update(data, DateTimeOffset.UtcNow);
                },
                cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Režimy autopilota nejsou pro letadlo dostupné.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeTransponder(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<SimConnectTransponderData>(
                SimConnectPeriod.Second,
                data => radioStore.UpdateTransponder(data.CodeBcd16, DateTimeOffset.UtcNow),
                cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogDebug(ex, "Transpondér není podporován; COM/NAV a PFD zůstávají dostupné.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeRadios(SimConnectClient client, CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<SimConnectRadioData>(
                SimConnectPeriod.Second,
                data =>
                {
                    if (data.IsValid())
                        radioStore.Update(data, DateTimeOffset.UtcNow);
                },
                cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Radio SimVars nejsou dostupné; PFD zůstává v provozu.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeA320Engines(SimConnectClient client,CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<A320SimConnectEngineData>(
                SimConnectPeriod.Second,data=>
                {
                    if(identity.Trusted(identity.Current.Title,DateTimeOffset.UtcNow))
                        a320.UpdateEngines(data,DateTimeOffset.UtcNow);
                },cancellationToken:token);
        }
        catch(Exception ex)
        {
            logger.LogWarning(ex,"Airbus engine SimVars unavailable; base PFD stays live.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeA320Aux(SimConnectClient client,CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<A320SimConnectAuxData>(
                SimConnectPeriod.Second,data=>
                {
                    if(identity.Trusted(identity.Current.Title,DateTimeOffset.UtcNow))
                        a320.UpdateAux(data,DateTimeOffset.UtcNow);
                },cancellationToken:token);
        }
        catch(Exception ex)
        {
            logger.LogWarning(ex,"A320 optional APU/fuel SimVars unavailable.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeA320Fcu(SimConnectClient client,CancellationToken token)
    {
        try
        {
            return client.SimVars.Subscribe<A320SimConnectFcuData>(
                SimConnectPeriod.Second,data=>
                {
                    if(identity.Trusted(identity.Current.Title,DateTimeOffset.UtcNow))
                        a320.UpdateFcu(data,DateTimeOffset.UtcNow);
                },cancellationToken:token);
        }
        catch(Exception ex)
        {
            logger.LogWarning(ex,"Airbus FCU SimVars unavailable; base PFD stays live.");
            return null;
        }
    }

    private ISimVarSubscription? SubscribeSystems(SimConnectClient client, CancellationToken token)
    {
        var invalidFrames = 0;
        try
        {
            // Samostatná strukturovaná 1Hz subscription, oddělená od PFD SimFrame.
            // Výpadek nepovinných systémových SimVars NESMÍ zastavit telemetrii PFD.
            return client.SimVars.Subscribe<SimConnectSystemsData>(
                SimConnectPeriod.Second,
                value =>
                {
                    if (!value.IsValid())
                    {
                        if (Interlocked.Increment(ref invalidFrames) == 1)
                            logger.LogWarning("Systémové SimVars obsahují neplatné hodnoty.");
                        return;
                    }
                    systemsStore.Update(AircraftSystemsStore.FromSimConnect(
                        value, Mode, DateTimeOffset.UtcNow));
                },
                cancellationToken: token);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Systémové SimVars nejsou dostupné, PFD bude nadále fungovat.");
            return null;
        }
    }
}
