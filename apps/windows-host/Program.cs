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

        // CI tests the *installed* version. This is read-only, never contacts
        // the release feed and must not start the tray/bridge or run updates.
        if (args is ["--verify-installed-version", var target])
        {
            try
            {
                var manager = new UpdateManager(
                    new GithubSource(HostSettings.DefaultFeedUrl, null, false));
                var installed = manager.IsInstalled
                    ? manager.CurrentVersion?.ToString() : null;
                return UpdateRecoveryJournal.MatchesTargetVersion(target, installed) ? 0 : 1;
            }
            catch (Exception ex)
            {
                EventLogFile.Write("C33 installed-version smoke failed: " + ex.GetType().Name);
                return 1;
            }
        }

        // Keep this before normal application startup: Velopack may run
        // short-lived install/uninstall hooks. Never auto-apply on launch.
        VelopackApp.Build().SetAutoApplyOnStartup(false).Run();

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
