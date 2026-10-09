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

    private static string? Clean(string? title)
    {
        var value=title?.Trim();
        return !string.IsNullOrWhiteSpace(value) && value.Length<=256 &&
               !value.Any(char.IsControl) ? value:null;
    }

    public void Reset() => Interlocked.Exchange(ref _state,
        new AircraftIdentitySnapshot(null,null,false,false));

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
        var changed=prior.Changed || clean is null ||
            !string.Equals(clean,prior.Title,StringComparison.Ordinal);
        Interlocked.Exchange(ref _state,
            new AircraftIdentitySnapshot(clean,at,changed,clean is not null));
    }

    public bool Trusted(string? telemetryTitle,DateTimeOffset at)
    {
        var current=Current;
        return current.Known&&!current.Changed&&current.ObservedAtUtc is { } observed
            &&at>=observed &&at-observed<TimeSpan.FromSeconds(10)
            &&string.Equals(current.Title,telemetryTitle,StringComparison.Ordinal);
    }
}
