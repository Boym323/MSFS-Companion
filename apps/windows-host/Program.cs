using Velopack;

namespace MsfsCompanion.WindowsHost;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        // Keep this before application startup: Velopack may run short-lived
        // install/uninstall hooks. Never apply a staged update blindly on launch.
        VelopackApp.Build().SetAutoApplyOnStartup(false).Run();

        if (args.Contains("--self-test"))
        {
            return UpdatePolicy.SelfTest() ? 0 : 1;
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
