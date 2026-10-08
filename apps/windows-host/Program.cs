using Velopack;
using Velopack.Sources;

namespace MsfsCompanion.WindowsHost;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        // CI self-test is not a Velopack install lifecycle command and must
        // run without the updater's packaging hooks or process exit logic.
        if (args.Contains("--self-test"))
        {
            return UpdatePolicy.SelfTest() && CompanionMdnsPublisher.SelfTest() && UpdateRecoveryJournal.SelfTest() ? 0 : 1;
        }

        // Velopack initialization is required before locating installed
        // metadata, including for our read-only CI probe. Lifecycle hooks
        // still execute before any ordinary application startup.
        VelopackApp.Build().SetAutoApplyOnStartup(false).Run();

        // CI tests the actual installed version without starting tray/bridge.
        // The updater feed is not contacted by reading CurrentVersion.
        if (args is ["--verify-installed-version", var target])
        {
            try
            {
                var manager = new UpdateManager(
                    new GithubSource(HostSettings.DefaultFeedUrl, null, false));
                var installed = manager.IsInstalled
                    ? manager.CurrentVersion?.ToString() : null;
                var match = UpdateRecoveryJournal.MatchesTargetVersion(target, installed);
                EventLogFile.Write($"C33 installed-version smoke: installed={manager.IsInstalled}, actual={installed ?? "unknown"}, expected={target}, match={match}");
                return match ? 0 : 1;
            }
            catch (Exception ex)
            {
                EventLogFile.Write("C33 installed-version smoke failed: " + ex.GetType().Name);
                return 1;
            }
        }

        using var mutex = new Mutex(true, @"Local\Boym323.MsfsCompanion.WindowsHost", out var firstInstance);
        if (!firstInstance)
        {
            return 0;
        }

        ApplicationConfiguration.Initialize();
        using var app = new CompanionTrayContext();
        Application.Run(app);
        return 0;
    }
}
