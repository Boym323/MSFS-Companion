using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.Json;
using SimConnect.NET;

namespace MsfsCompanion.Probe;

// Read-only Windows compatibility diagnostic. This process never invokes SimConnect
// write APIs, including ClientEvent, SetInputEvent, SetAsync or ExecuteCalculatorCode.
internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private static async Task<int> Main(string[] args)
    {
        if (Array.Exists(args, x => x is "--help" or "-h"))
        {
            ShowHelp();
            return 0;
        }

        ProbeOptions options;
        try
        {
            options = ProbeOptions.Parse(args);
        }
        catch (ArgumentException ex)
        {
            Console.Error.WriteLine($"Invalid arguments: {ex.Message}");
            ShowHelp();
            return 2;
        }

        var report = new ProbeReport
        {
            StartedAtUtc = DateTimeOffset.UtcNow,
            MachineArchitecture = RuntimeInformation.ProcessArchitecture.ToString(),
            OperatingSystem = RuntimeInformation.OSDescription,
            RuntimeVersion = Environment.Version.ToString(),
            SimConnectLibraryVersion = typeof(SimConnectClient).Assembly.GetName().Version?.ToString() ?? "unknown",
            LVars = new FeatureResult("not_tested", "Specify --lvar L:KNOWN_NAME to attempt a read-only check."),
            InputEvents = new FeatureResult("not_tested", "Not yet connected.")
        };

        if (options.SelfTest)
        {
            report.Connection = "self_test_only";
            report.InputEvents = new FeatureResult("not_tested", "Self-test deliberately does not connect to MSFS.");
            report.FinishedAtUtc = DateTimeOffset.UtcNow;
            await SaveReportAsync(report, options.ReportPath);
            Console.WriteLine("PASS: report serialization works; no simulator was contacted.");
            return 0;
        }

        if (!OperatingSystem.IsWindows() || RuntimeInformation.ProcessArchitecture != Architecture.X64)
        {
            Console.Error.WriteLine("The SimConnect probe must run on Windows x64.");
            report.Connection = "unsupported_platform";
            report.Errors.Add("Windows x64 is required.");
            report.FinishedAtUtc = DateTimeOffset.UtcNow;
            await SaveReportAsync(report, options.ReportPath);
            return 2;
        }

        Console.WriteLine("MSFS COMPANION — SIMCONNECT PROBE B1");
        Console.WriteLine("Read-only: no airplane settings or simulator events will be changed.");
        Console.WriteLine("Start MSFS 2020, load an aircraft and enter the flight before probing.");
        Console.WriteLine($"Connection wait: {options.WaitSeconds}s; sampling: {options.DurationSeconds}s.");
        Console.WriteLine($"Report: {Path.GetFullPath(options.ReportPath)}");
        Console.WriteLine();

        using var stopping = new CancellationTokenSource();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            stopping.Cancel();
        };

        var connectionDeadline = DateTimeOffset.UtcNow.AddSeconds(options.WaitSeconds);
        DateTimeOffset? measurementDeadline = null;
        var featureChecksPerformed = false;

        try
        {
            while (!stopping.IsCancellationRequested
                   && DateTimeOffset.UtcNow < (measurementDeadline ?? connectionDeadline))
            {
                report.ConnectionAttempts++;
                Console.WriteLine($"Connecting to MSFS (attempt {report.ConnectionAttempts})...");

                try
                {
                    await using var client = new SimConnectClient("MSFS Companion B1 Diagnostic")
                    {
                        AutoReconnectEnabled = false
                    };

                    client.ConnectionStatusChanged += (_, _) =>
                        Console.WriteLine($"  SimConnect connection state changed; connected = {client.IsConnected}");
                    client.ErrorOccurred += (_, e) => Console.WriteLine($"  SimConnect warning: {e}");

                    using (var connectTimeout = CancellationTokenSource.CreateLinkedTokenSource(stopping.Token))
                    {
                        connectTimeout.CancelAfter(TimeSpan.FromSeconds(10));
                        await client.ConnectAsync(cancellationToken: connectTimeout.Token);
                    }

                    report.SuccessfulConnections++;
                    report.Connection = "connected";
                    report.Simulator = client.IsMSFS2024
                        ? "MSFS 2024 detected (B1 targets MSFS 2020)"
                        : "MSFS 2020-compatible (confirm installed simulator locally)";
                    measurementDeadline ??= DateTimeOffset.UtcNow.AddSeconds(options.DurationSeconds);
                    Console.WriteLine("CONNECTED. Reading flight data...");

                    if (!featureChecksPerformed)
                    {
                        featureChecksPerformed = true;
                        await CheckFeaturesAsync(client, options, report, stopping.Token);
                    }

                    while (!stopping.IsCancellationRequested
                           && DateTimeOffset.UtcNow < measurementDeadline.Value)
                    {
                        using var queryTimeout = CancellationTokenSource.CreateLinkedTokenSource(stopping.Token);
                        queryTimeout.CancelAfter(TimeSpan.FromSeconds(15));

                        // Deliberately low-rate, sequential requests: B1 is a compatibility
                        // probe, NOT a performance-optimized live cockpit telemetry source.
                        var stopwatch = Stopwatch.StartNew();
                        var sample = await ReadSampleAsync(client, queryTimeout.Token);
                        stopwatch.Stop();

                        report.Samples.Add(sample with { ReadLatencyMilliseconds = stopwatch.ElapsedMilliseconds });
                        Console.WriteLine(
                            $"  IAS {sample.AirspeedKnots:F1} kt | ALT {sample.AltitudeFeet:F0} ft | " +
                            $"HDG {sample.HeadingDegrees:F0}° | VS {sample.VerticalSpeedFeetPerMinute:F0} fpm | " +
                            $"PITCH {sample.PitchDegrees:F1}° | BANK {sample.BankDegrees:F1}° " +
                            $"({stopwatch.ElapsedMilliseconds} ms)");

                        await Task.Delay(TimeSpan.FromSeconds(1), stopping.Token);
                    }
                }
                catch (OperationCanceledException) when (stopping.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    report.Connection = report.SuccessfulConnections > 0 ? "disconnected" : "not_connected";
                    RecordError(report, ex);
                    Console.WriteLine($"  {ex.GetType().Name}: {ex.Message}");
                    if (measurementDeadline is { } deadline && DateTimeOffset.UtcNow >= deadline)
                    {
                        break;
                    }

                    Console.WriteLine("  Retrying in 3 seconds (Ctrl+C to stop)...");
                    try
                    {
                        await Task.Delay(TimeSpan.FromSeconds(3), stopping.Token);
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                }
            }
        }
        finally
        {
            report.FinishedAtUtc = DateTimeOffset.UtcNow;
            report.Connection = report.Samples.Count > 0
                ? "samples_collected"
                : report.Connection == "connected" ? "no_samples" : report.Connection;
            await SaveReportAsync(report, options.ReportPath);
            Console.WriteLine();
            Console.WriteLine($"Report saved: {Path.GetFullPath(options.ReportPath)}");
            Console.WriteLine($"Connection attempts: {report.ConnectionAttempts}; samples: {report.Samples.Count}; errors: {report.Errors.Count}");
        }

        return report.Samples.Count > 0 ? 0 : 3;
    }

    private static async Task<ProbeSample> ReadSampleAsync(SimConnectClient client, CancellationToken ct)
    {
        var vars = client.SimVars;
        var latitude = await vars.GetAsync<double>("PLANE LATITUDE", "degrees", cancellationToken: ct);
        var longitude = await vars.GetAsync<double>("PLANE LONGITUDE", "degrees", cancellationToken: ct);
        var ias = await vars.GetAsync<double>("AIRSPEED INDICATED", "knots", cancellationToken: ct);
        var altitude = await vars.GetAsync<double>("INDICATED ALTITUDE", "feet", cancellationToken: ct);
        var verticalSpeed = await vars.GetAsync<double>("VERTICAL SPEED", "feet per minute", cancellationToken: ct);
        var heading = await vars.GetAsync<double>("PLANE HEADING DEGREES MAGNETIC", "degrees", cancellationToken: ct);
        var pitch = await vars.GetAsync<double>("PLANE PITCH DEGREES", "degrees", cancellationToken: ct);
        var bank = await vars.GetAsync<double>("PLANE BANK DEGREES", "degrees", cancellationToken: ct);

        var values = new[] { latitude, longitude, ias, altitude, verticalSpeed, heading, pitch, bank };
        if (values.Any(x => !double.IsFinite(x)) || Math.Abs(latitude) > 90 || Math.Abs(longitude) > 180)
        {
            throw new InvalidDataException("Simulator returned non-finite telemetry or invalid geographic coordinates.");
        }

        return new ProbeSample(
            DateTimeOffset.UtcNow, latitude, longitude, ias, altitude,
            verticalSpeed, heading, pitch, bank, ReadLatencyMilliseconds: 0);
    }

    private static async Task CheckFeaturesAsync(
        SimConnectClient client,
        ProbeOptions options,
        ProbeReport report,
        CancellationToken ct)
    {
        if (options.SkipInputEvents)
        {
            report.InputEvents = new FeatureResult("skipped", "Skipped by --skip-input-events.");
        }
        else
        {
            Console.WriteLine("Checking read-only Input Events enumeration...");
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(8));
                var inputEvents = await client.InputEvents.EnumerateInputEventsAsync(timeout.Token);
                report.InputEvents = new FeatureResult(
                    "enumeration_successful",
                    "Enumeration succeeded. Availability and semantics vary by aircraft.",
                    inputEvents.Length);
                Console.WriteLine($"  Input Events: {inputEvents.Length} discovered");
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                report.InputEvents = new FeatureResult(
                    "timeout_or_unavailable",
                    "No enumeration response within 8 seconds; support not confirmed.");
                Console.WriteLine("  Input Events: timed out (not automatically unsupported).");
            }
            catch (Exception ex)
            {
                report.InputEvents = new FeatureResult("error", ex.Message);
                Console.WriteLine($"  Input Events: {ex.Message}");
            }
        }

        if (options.LVarName is not null)
        {
            Console.WriteLine($"Checking optional LVar {options.LVarName} (read-only)...");
            try
            {
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeout.CancelAfter(TimeSpan.FromSeconds(6));
                var value = await client.SimVars.GetAsync<double>(
                    options.LVarName, "number", cancellationToken: timeout.Token);
                report.LVars = new FeatureResult(
                    "read_returned_value",
                    $"SimConnect returned value {value:G6}. This does NOT prove the variable was defined in the aircraft.");
                Console.WriteLine($"  LVar returned: {value:G6}");
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
            {
                report.LVars = new FeatureResult("error_or_unavailable", ex.Message);
                Console.WriteLine($"  LVar: {ex.Message}");
            }
        }
    }

    private static void RecordError(ProbeReport report, Exception ex)
    {
        if (report.Errors.Count < 50)
        {
            report.Errors.Add($"{DateTimeOffset.UtcNow:O}: {ex.GetType().Name}: {ex.Message}");
        }
    }

    private static async Task SaveReportAsync(ProbeReport report, string path)
    {
        var absolute = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(absolute)!);
        var temporary = absolute + ".tmp";
        try
        {
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(report, JsonOptions));
            File.Move(temporary, absolute, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static void ShowHelp()
    {
        Console.WriteLine("MSFS Companion SimConnect Probe B1 (Windows x64; read-only)");
        Console.WriteLine("  --wait SECONDS          Time to wait for MSFS on startup (5..600, default 90)");
        Console.WriteLine("  --duration SECONDS      Collection window after connect (5..300, default 30)");
        Console.WriteLine("  --report PATH           JSON destination (default: Documents/MSFS Companion/simconnect-report.json)");
        Console.WriteLine("  --lvar L:KNOWN_NAME     Optional read-only LVar probe (known aircraft variable only)");
        Console.WriteLine("  --skip-input-events     Skip read-only Input Events enumeration");
        Console.WriteLine("  --self-test             Test report export without contacting MSFS");
        Console.WriteLine("  --help                  Show this help");
    }
}

internal sealed record ProbeOptions(
    int WaitSeconds,
    int DurationSeconds,
    string ReportPath,
    string? LVarName,
    bool SkipInputEvents,
    bool SelfTest)
{
    public static ProbeOptions Parse(string[] args)
    {
        var wait = 90;
        var duration = 30;
        var report = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
            "MSFS Companion",
            "simconnect-report.json");
        string? lvar = null;
        var skipInputEvents = false;
        var selfTest = false;

        for (var index = 0; index < args.Length; index++)
        {
            var option = args[index];
            if (option == "--skip-input-events")
            {
                skipInputEvents = true;
                continue;
            }

            if (option == "--self-test")
            {
                selfTest = true;
                continue;
            }

            if (++index >= args.Length)
            {
                throw new ArgumentException($"Missing value for {option}.");
            }

            var value = args[index];
            switch (option)
            {
                case "--wait" when int.TryParse(value, out var w) && w is >= 5 and <= 600:
                    wait = w;
                    break;
                case "--duration" when int.TryParse(value, out var d) && d is >= 5 and <= 300:
                    duration = d;
                    break;
                case "--report" when !string.IsNullOrWhiteSpace(value):
                    report = value;
                    break;
                case "--lvar" when value.StartsWith("L:", StringComparison.OrdinalIgnoreCase)
                                   && value.Length is >= 3 and <= 128
                                   && value.AsSpan(2).IndexOfAnyExcept(
                                       "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_:-".AsSpan()) < 0:
                    lvar = value;
                    break;
                default:
                    throw new ArgumentException($"Unknown or invalid option: {option} {value}.");
            }
        }

        return new ProbeOptions(wait, duration, report, lvar, skipInputEvents, selfTest);
    }
}

internal sealed class ProbeReport
{
    public string SchemaVersion { get; } = "simconnect-probe-v1";
    public DateTimeOffset StartedAtUtc { get; set; }
    public DateTimeOffset? FinishedAtUtc { get; set; }
    public string OperatingSystem { get; set; } = "";
    public string MachineArchitecture { get; set; } = "";
    public string RuntimeVersion { get; set; } = "";
    public string SimConnectLibraryVersion { get; set; } = "";
    public string Simulator { get; set; } = "unknown";
    public string Connection { get; set; } = "not_connected";
    public int ConnectionAttempts { get; set; }
    public int SuccessfulConnections { get; set; }
    public FeatureResult InputEvents { get; set; } = new("not_tested", "Not yet connected.");
    public FeatureResult LVars { get; set; } = new("not_tested", "Not yet connected.");
    public List<ProbeSample> Samples { get; } = [];
    public List<string> Errors { get; } = [];
}

internal sealed record FeatureResult(string Status, string Detail, int? Count = null);

internal sealed record ProbeSample(
    DateTimeOffset TimestampUtc,
    double Latitude,
    double Longitude,
    double AirspeedKnots,
    double AltitudeFeet,
    double VerticalSpeedFeetPerMinute,
    double HeadingDegrees,
    double PitchDegrees,
    double BankDegrees,
    long ReadLatencyMilliseconds);
