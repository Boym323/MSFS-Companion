namespace MsfsCompanion.Bridge.Telemetry;

/// <summary>
/// Omezující exponenciální prodleva po opakovaných neúspěších.
/// Po alespoň jednom živém publikovaném snímku se počítadlo resetuje.
/// </summary>
public static class SimConnectRetryPolicy
{
    public static TimeSpan DelayAfter(int consecutiveFailures)
    {
        var safe = Math.Clamp(consecutiveFailures, 1, 5);
        return TimeSpan.FromSeconds(Math.Min(15, 3 * (1 << (safe - 1))));
    }
}
