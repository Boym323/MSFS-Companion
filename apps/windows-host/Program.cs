using Velopack;

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
            return UpdatePolicy.SelfTest() ? 0 : 1;
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
