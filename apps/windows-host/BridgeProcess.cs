using System.Diagnostics;

namespace MsfsCompanion.WindowsHost;

internal sealed class BridgeProcess : IDisposable
{
    private Process? _child;
    private readonly Func<string> _telemetryMode;
    private readonly Func<bool> _mdnsEnabled;
    private readonly Func<string> _mdnsName;
    private string? _boundAddress;
    public LanAccess.LanAddress? BoundLan { get; private set; }

    public BridgeProcess(Func<string> telemetryMode, Func<bool> mdnsEnabled, Func<string> mdnsName)
    {
        _telemetryMode = telemetryMode;
        _mdnsEnabled = mdnsEnabled;
        _mdnsName = mdnsName;
    }
    public bool IsRunning
    {
        get
        {
            if (_child is null)
                return false;

            try
            {
                return !_child.HasExited;
            }
            catch
            {
                return false;
            }
        }
    }

    public void EnsureStarted()
    {
        var lan = LanAccess.Find(_boundAddress);
        var currentLanAddress = lan?.Address.ToString();
        if (IsRunning && string.Equals(currentLanAddress, _boundAddress, StringComparison.Ordinal))
            return;

        Stop();

        var folder = Path.Combine(AppContext.BaseDirectory, "bridge");
        var exePath = Path.Combine(folder, "MsfsCompanion.Bridge.exe");
        if (!File.Exists(exePath))
        {
            EventLogFile.Write($"Bridge missing: {exePath}");
            return;
        }

        try
        {
            var info = new ProcessStartInfo(exePath)
            {
                WorkingDirectory = folder,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };
            info.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
            info.Environment["DOTNET_NOLOGO"] = "1";
            // Windows aplikace v produkci čte skutečný SimConnect.
            // Pro diagnostiku lze proces spustit s proměnnou = mock.
            info.Environment["MSFS_COMPANION_TELEMETRY_MODE"] =
                Environment.GetEnvironmentVariable("MSFS_COMPANION_TELEMETRY_MODE") ?? _telemetryMode();
            info.Environment["MSFS_COMPANION_CONTROL_DIR"] = AdminControl.ControlDirectory;
            info.Environment.Remove("MSFS_COMPANION_MDNS_NAME");

            // Samostatný bridge zůstává na localhostu. Instalovaný hostitel
            // přidá pouze konkrétní privátní IPv4 adresu Wi-Fi/Ethernet adaptéru.
            if (lan is not null)
            {
                info.Environment["Kestrel__Endpoints__Lan__Url"] = $"http://{lan.Address}:8765";
                info.Environment["MSFS_COMPANION_LAN_ADDRESS"] = lan.Address.ToString();
                info.Environment["MSFS_COMPANION_LAN_NETMASK"] = lan.Mask.ToString();
                if (_mdnsEnabled() &&
                    HostSettings.TryNormalizeMdnsName(_mdnsName(), out var shortName, out _))
                    info.Environment["MSFS_COMPANION_MDNS_NAME"] = shortName + ".local";
                EventLogFile.Write($"Dashboard v domácí síti: {lan.DashboardUrl}");
            }
            else
            {
                EventLogFile.Write("Soukromá IPv4 adresa nenalezena; dashboard zůstává jen na localhostu.");
            }

            _child = new Process { StartInfo = info, EnableRaisingEvents = true };
            _child.OutputDataReceived += (_, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data)) EventLogFile.Write("Bridge: " + e.Data);
            };
            _child.ErrorDataReceived += (_, e) =>
            {
                if (!string.IsNullOrEmpty(e.Data)) EventLogFile.Write("Bridge error: " + e.Data);
            };
            _child.Start();
            _child.BeginOutputReadLine();
            _child.BeginErrorReadLine();
            _boundAddress = currentLanAddress;
            BoundLan = lan;
            EventLogFile.Write($"Bridge started, PID {_child.Id}");
        }
        catch (Exception ex)
        {
            EventLogFile.Write($"Bridge start failure: {ex}");
            Stop();
        }
    }

    public void Stop()
    {
        if (_child is null)
            return;

        try
        {
            if (!_child.HasExited)
            {
                _child.Kill(entireProcessTree: true);
                _child.WaitForExit(milliseconds: 3000);
            }
        }
        catch (Exception ex)
        {
            EventLogFile.Write($"Bridge stop failure: {ex.Message}");
        }
        finally
        {
            _child.Dispose();
            _child = null;
            _boundAddress = null;
            BoundLan = null;
        }
    }

    public void Dispose() => Stop();
}
