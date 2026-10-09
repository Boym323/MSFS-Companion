using MsfsCompanion.Bridge.Telemetry;

// Deterministický scénář: MSFS poskytuje přesně 30 snímků každou sekundu;
// nezávislá publikační smyčka tiká 20x/s. Žádné čekání na skutečný čas.
var buffer = new LatestFrameBuffer<int>();
var health = new TelemetryHealth();
health.StartConnecting();

var baseUtc = DateTimeOffset.UtcNow.AddSeconds(-2);
long lastPublished = 0;
var seen = new HashSet<long>();
var received = 0;
var published = 0;
var skipped = 0;

for (var tick = 0; tick < 600; tick++) // krok 1/600 sekundy
{
    var now = baseUtc.AddTicks((long)Math.Round(tick * TimeSpan.TicksPerSecond / 600.0));
    if (tick % 20 == 0) // 30 FPS
    {
        received++;
        buffer.Write(received, now, tick);
        health.RecordIncoming(now);
    }

    if ((tick + 1) % 30 == 0) // 20Hz publisher
    {
        var before = lastPublished;
        if (buffer.TryReadNew(ref lastPublished, out var frame))
        {
            if (frame is null || !seen.Add(frame.Sequence))
                throw new Exception("Duplicitní SimConnect frame!");
            published++;
            var dropped = Math.Max(0, frame.Sequence - before - 1);
            skipped += (int)dropped;
            health.RecordPublished(frame.ReceivedUtc, now, dropped);
        }

        // Ve stejném taktu nesmí jít vytáhnout vzorek ještě jednou.
        if (buffer.TryReadNew(ref lastPublished, out _))
            throw new Exception("Jeden SimConnect frame byl publikován vícekrát.");
    }
}

var status = health.Snapshot("simconnect");
if (received != 30 || published != 20 || skipped != 10)
    throw new Exception($"Nesprávné převzorkování: přijato={received}, publikováno={published}, přeskočeno={skipped}.");
if (status.SamplesReceived != 30 || status.SamplesPublished != 20 || status.FramesSkipped != 10)
    throw new Exception("Metriky neodpovídají skutečnému počtu různých vzorků.");
if (Math.Abs(status.IncomingRateHz - 30) > 0.5 || Math.Abs(status.SampleRateHz - 20) > 0.5)
    throw new Exception($"Metriky frekvencí jsou chybné: {status.IncomingRateHz} / {status.SampleRateHz} Hz.");
if (status.PublicationLagMs is null or < 0 or > 51)
    throw new Exception($"Nepřiměřené zpoždění v publikační frontě: {status.PublicationLagMs} ms.");

// Nový zdroj po reconnectu musí zahájit čítač taktu od začátku a hlásit
// nulové aktuální frekvence. Kumulativní počitadla mohou zůstat zachována.
health.SetWaiting("MSFS není připojen");
var disconnected = health.Snapshot("simconnect");
if (disconnected.Connected || disconnected.SampleRateHz != 0 || disconnected.IncomingRateHz != 0)
    throw new Exception("Při výpadku nesmí zůstat stav živý.");
health.StartConnecting();
if (health.Snapshot("simconnect").ConnectionAttempts != 2)
    throw new Exception("Počet reconnect pokusů je nesprávný.");

// C32 – deterministický backoff: omezený a resetovatelný, bez časovačového čekání.
var waits = new[] {3,6,12,15,15,15};
for (var i = 0; i < waits.Length; i++)
    if (SimConnectRetryPolicy.DelayAfter(i+1).TotalSeconds != waits[i])
        throw new Exception("Nesprávná exponenciální prodleva SimConnect.");
if (SimConnectRetryPolicy.DelayAfter(0) != TimeSpan.FromSeconds(3))
    throw new Exception("Po úspěšném letu musí být další reconnect rychlý.");

Console.WriteLine("PASS: 30 FPS -> 20 různých snímků/s; příjem, zpoždění, skip a reconnect jsou korektní.");
