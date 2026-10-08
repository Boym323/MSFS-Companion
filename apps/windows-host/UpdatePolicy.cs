using System.Diagnostics;

namespace MsfsCompanion.WindowsHost;

internal static class UpdatePolicy
{
    // A new app version must never interrupt MSFS, including an aircraft
    // selection screen or a session with the simulator process running.
    public static bool MayApply(bool updateDownloaded, bool simulatorRunning, bool exiting) =>
        updateDownloaded && !simulatorRunning && !exiting;

    public static bool SimulatorRunning()
    {
        try
        {
            foreach (var name in new[] { "FlightSimulator", "FlightSimulator2024" })
            {
                var processes = Process.GetProcessesByName(name);
                try
                {
                    if (processes.Length > 0)
                    {
                        return true;
                    }
                }
                finally
                {
                    foreach (var process in processes)
                    {
                        process.Dispose();
                    }
                }
            }

            return false;
        }
        catch (Exception ex)
        {
            EventLogFile.Write($"Cannot safely determine simulator state: {ex.Message}");
            // Fail closed: when we cannot check, never restart for an update.
            return true;
        }
    }

    public static bool SelfTest()
    {
        var cases = new (bool Downloaded, bool InGame, bool Exiting, bool Expected)[]
        {
            (false, false, false, false),
            (true, true, false, false),
            (true, false, true, false),
            (true, false, false, true),
        };

        var result = cases.All(c => MayApply(c.Downloaded, c.InGame, c.Exiting) == c.Expected);
        Console.WriteLine(result ? "Update safety self-test PASS" : "Update safety self-test FAIL");
        return result;
    }
}
