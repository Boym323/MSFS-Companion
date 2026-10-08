namespace MsfsCompanion.WindowsHost;

internal static class UpdatePolicy
{
    // Development channel: only the Companion host and its bridge restart.
    // MSFS is never stopped or modified. An active dashboard may temporarily
    // disconnect; it reconnects after the updated bridge returns.
    public static bool MayApply(bool updateDownloaded, bool exiting, bool alreadyApplying) =>
        updateDownloaded && !exiting && !alreadyApplying;

    public static bool SelfTest()
    {
        // An active MSFS session is deliberately not a blocking condition.
        var cases = new (bool Downloaded, bool Exiting, bool AlreadyApplying, bool Expected)[]
        {
            (false, false, false, false),
            (true, true, false, false),
            (true, false, true, false),
            (true, false, false, true)
        };

        var result = cases.All(c =>
            MayApply(c.Downloaded, c.Exiting, c.AlreadyApplying) == c.Expected);
        result &= HostSettings.DefaultFeedUrl == "https://github.com/Boym323/MSFS-Companion";
        result &= HostSettings.TryValidateFeed(HostSettings.DefaultFeedUrl, out _);

        Console.WriteLine(result ? "Update policy self-test PASS" : "Update policy self-test FAIL");
        return result;
    }
}
