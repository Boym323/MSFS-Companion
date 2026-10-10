namespace MsfsCompanion.Bridge.Aircraft;

/// <summary>
/// Authoritative aircraft identity for the live connection. A TITLE change
/// immediately invalidates command authorization and triggers reconnect.
/// Unknown/old TITLE never authorizes simulator write operations.
/// </summary>
public sealed record AircraftIdentitySnapshot(string? Title,
    DateTimeOffset? ObservedAtUtc, bool Changed, bool Known);

public sealed class AircraftIdentityGuard
{
    private AircraftIdentitySnapshot _state = new(null,null,false,false);
    public AircraftIdentitySnapshot Current => Volatile.Read(ref _state);
    private long _generation;
    /// <summary>Changes on each connection; never trust arm permission across reconnect.</summary>
    public long Generation => Interlocked.Read(ref _generation);

    private static string? Clean(string? title)
    {
        var value=title?.Trim();
        return !string.IsNullOrWhiteSpace(value) && value.Length<=256 &&
               !value.Any(char.IsControl) ? value:null;
    }

    public void Reset()
    {
        Interlocked.Increment(ref _generation);
        Interlocked.Exchange(ref _state,
            new AircraftIdentitySnapshot(null,null,false,false));
    }

    public void Begin(string? title,DateTimeOffset at)
    {
        var clean=Clean(title);
        Interlocked.Exchange(ref _state,
            new AircraftIdentitySnapshot(clean,at,false,clean is not null));
    }

    public void Observe(string? title,DateTimeOffset at)
    {
        var clean=Clean(title);
        var prior=Current;
        // Once switched, never re-qualify the old connection.
        // Missing TITLE is not proof that the aircraft changed. Revoke command
        // trust immediately, but retain the last known title for comparison.
        // A later different, valid title still forces a new SimConnect session.
        if (clean is null)
        {
            Interlocked.Exchange(ref _state,
                new AircraftIdentitySnapshot(prior.Title,at,prior.Changed,false));
            return;
        }

        // A failed initial one-shot read must not create a fake aircraft
        // identity. The first valid subscription sample becomes the baseline.
        var changed=prior.Changed || (prior.Title is not null &&
            !string.Equals(clean,prior.Title,StringComparison.Ordinal));
        Interlocked.Exchange(ref _state,
            new AircraftIdentitySnapshot(clean,at,changed,true));
    }

    // A failed optional TITLE reader must never keep write permissions alive.
    // Flight telemetry may continue, while controls fail closed until a
    // fresh, matching TITLE arrives.
    public void MarkUnavailable()
    {
        var prior=Current;
        Interlocked.Exchange(ref _state,prior with { Known=false });
    }

    public bool RequiresReconnect => Current.Changed;

    public bool Trusted(string? telemetryTitle,DateTimeOffset at)
    {
        var current=Current;
        return current.Known&&!current.Changed&&current.ObservedAtUtc is { } observed
            &&at>=observed &&at-observed<TimeSpan.FromSeconds(10)
            &&string.Equals(current.Title,telemetryTitle,StringComparison.Ordinal);
    }
}
