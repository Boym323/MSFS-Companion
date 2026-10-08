using System.Diagnostics;
using System.Drawing;
using Velopack;
using Velopack.Sources;

namespace MsfsCompanion.WindowsHost;

internal sealed class CompanionTrayContext : ApplicationContext
{
    private readonly NotifyIcon _icon;
    private readonly BridgeProcess _bridge = new();
    private readonly System.Windows.Forms.Timer _healthTimer;
    private readonly System.Windows.Forms.Timer _updateTimer;
    private readonly System.Windows.Forms.Timer _webRequestTimer;
    private readonly ToolStripMenuItem _updateStatus;
    private readonly ToolStripMenuItem _automaticUpdates;
    private HostSettings _settings = HostSettings.Load();
    private UpdateManager? _updateManager;
    private UpdateInfo? _pendingUpdate;
    private bool _checking;
    private bool _applyingUpdate;
    private bool _exiting;

    public CompanionTrayContext()
    {
        _updateStatus = new ToolStripMenuItem("Aktualizace: GitHub Releases") { Enabled = false };
        _automaticUpdates = new ToolStripMenuItem("Automatické aktualizace")
        {
            Checked = _settings.AutomaticUpdates,
            CheckOnClick = true
        };
        _automaticUpdates.CheckedChanged += (_, _) =>
        {
            _settings.AutomaticUpdates = _automaticUpdates.Checked;
            _settings.Save();
            if (!_settings.AutomaticUpdates) _pendingUpdate = null;
            _updateStatus.Text = _settings.AutomaticUpdates ? "Aktualizace: zapnuté" : "Aktualizace: vypnuté";
            if (_settings.AutomaticUpdates) _ = CheckUpdatesAsync();
        };

        var menu = new ContextMenuStrip();
        menu.Items.Add(new ToolStripMenuItem("Otevřít dashboard", null, (_, _) => OpenDashboard()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(_updateStatus);
        menu.Items.Add(new ToolStripMenuItem("Zkontrolovat aktualizace", null, async (_, _) => await CheckUpdatesAsync(force: true)));
        menu.Items.Add(_automaticUpdates);
        menu.Items.Add(new ToolStripMenuItem("Nastavit aktualizační zdroj…", null, (_, _) => ConfigureUpdateFeed()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Zkopírovat adresu dashboardu v LAN", null, (_, _) =>
        {
            var lan = LanAccess.Find();
            if (lan is null)
            {
                MessageBox.Show("Nebyla nalezena privátní IPv4 adresa Wi-Fi nebo Ethernetu. " +
                    "Zkontrolujte připojení počítače k domácí síti.",
                    "MSFS Companion", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            Clipboard.SetText(lan.DashboardUrl);
            MessageBox.Show($"Adresa pro Mac a ostatní zařízení v domácí síti byla zkopírována:\n{lan.DashboardUrl}",
                "MSFS Companion", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }));
        menu.Items.Add(new ToolStripMenuItem("Otevřít diagnostický log", null, (_, _) =>
            Process.Start(new ProcessStartInfo("notepad.exe", $"\"{EventLogFile.PathOnDisk}\"") { UseShellExecute = true })));
        menu.Items.Add(new ToolStripMenuItem("Ukončit MSFS Companion", null, (_, _) => ExitThread()));

        _icon = new NotifyIcon
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath) ?? SystemIcons.Application,
            Text = "MSFS Companion – běží na pozadí",
            Visible = true,
            ContextMenuStrip = menu
        };
        _icon.DoubleClick += (_, _) => OpenDashboard();

        AdminControl.WriteStatus("idle", "Připraveno ke kontrole aktualizací.");
        _bridge.EnsureStarted();

        _webRequestTimer = new System.Windows.Forms.Timer { Interval = 1800 };
        _webRequestTimer.Tick += async (_, _) =>
        {
            if (_exiting || _checking || _applyingUpdate || !AdminControl.HasPendingRequests())
                return;

            EventLogFile.Write("Požadavek na kontrolu aktualizací z webu v domácí síti.");
            await CheckUpdatesAsync(force: true, fromWeb: true);
        };
        _webRequestTimer.Start();

        _healthTimer = new System.Windows.Forms.Timer { Interval = 10000 };
        _healthTimer.Tick += (_, _) => _bridge.EnsureStarted();
        _healthTimer.Start();

        _updateTimer = new System.Windows.Forms.Timer { Interval = 20000 };
        _updateTimer.Tick += async (_, _) =>
        {
            _updateTimer.Stop();
            await CheckUpdatesAsync();
            if (!_exiting)
            {
                _updateTimer.Interval = 60 * 60 * 1000;
                _updateTimer.Start();
            }
        };
        _updateTimer.Start();

        EventLogFile.Write("Windows tray host started; development updates may restart only the Companion bridge, even while MSFS runs.");
    }

    private static void OpenDashboard()
    {
        Process.Start(new ProcessStartInfo("http://127.0.0.1:8765/admin")
        {
            UseShellExecute = true
        });
    }

    private void ConfigureUpdateFeed()
    {
        using var form = new Form
        {
            Text = "Zdroj aktualizací – MSFS Companion",
            Width = 550,
            Height = 185,
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MinimizeBox = false,
            MaximizeBox = false,
            ShowInTaskbar = true
        };
        var label = new Label { Text = "HTTPS adresa Velopack feedu (veřejný releases server):", AutoSize = true, Left = 16, Top = 16 };
        var input = new TextBox { Left = 16, Top = 43, Width = 500, Text = _settings.UpdateFeedUrl ?? "" };
        var save = new Button { Text = "Uložit", Width = 105, Left = 304, Top = 81, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Zrušit", Width = 105, Left = 413, Top = 81, DialogResult = DialogResult.Cancel };
        form.Controls.AddRange([label, input, save, cancel]);
        form.AcceptButton = save;
        form.CancelButton = cancel;

        if (_checking || _applyingUpdate)
        {
            MessageBox.Show("Počkejte prosím na dokončení aktuální kontroly aktualizací.",
                "Aktualizace", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        if (form.ShowDialog() != DialogResult.OK)
            return;

        var url = input.Text.Trim();
        if (url.Length > 0 && !HostSettings.TryValidateFeed(url, out var message))
        {
            MessageBox.Show(message, "Neplatný zdroj", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        _settings.UpdateFeedUrl = url.Length == 0 ? HostSettings.DefaultFeedUrl : url.TrimEnd('/');
        _settings.Save();
        _updateManager = null;
        _pendingUpdate = null;
        EventLogFile.Write("Update feed changed by user.");
        _ = CheckUpdatesAsync();
    }

    private static UpdateManager CreateUpdateManager(string feedUrl)
    {
        var uri = new Uri(feedUrl);
        if (uri.Host.Equals("github.com", StringComparison.OrdinalIgnoreCase))
        {
            // Public binary-only GitHub repository. Never embed a PAT.
            return new UpdateManager(new GithubSource(feedUrl, null, false));
        }

        return new UpdateManager(feedUrl);
    }

    private void ShowManualUpdateMessage(string message, MessageBoxIcon icon = MessageBoxIcon.Information)
    {
        // A tray menu closes as soon as a command is clicked. Updating only
        // the disabled _updateStatus menu item would be invisible to the user.
        // Show a dialog ONLY for an explicitly requested manual check; the
        // background hourly check must remain silent during an MSFS flight.
        if (!_exiting)
            MessageBox.Show(message, "MSFS Companion – aktualizace",
                MessageBoxButtons.OK, icon);
    }

    private void ShowUpdateBalloon(string message, ToolTipIcon icon = ToolTipIcon.Info)
    {
        if (!_exiting && _icon.Visible)
        {
            // Non-modal progress: the user can keep using the simulator.
            _icon.ShowBalloonTip(3500, "MSFS Companion", message, icon);
        }
    }

    private async Task CheckUpdatesAsync(bool force = false, bool fromWeb = false)
    {
        if (_exiting || (!_settings.AutomaticUpdates && !force))
            return;

        if (_checking || _applyingUpdate)
        {
            if (force && !fromWeb)
                ShowManualUpdateMessage("Kontrola nebo instalace aktualizace už právě probíhá.");
            return;
        }

        if (string.IsNullOrWhiteSpace(_settings.UpdateFeedUrl))
        {
            _updateStatus.Text = "Aktualizace: chybí HTTPS zdroj";
            AdminControl.WriteStatus("error", "Není nastaven zdroj aktualizací.");
            EventLogFile.Write("Update check skipped: no feed configured.");
            if (force && !fromWeb)
                ShowManualUpdateMessage("Není nastaven zdroj aktualizací. Ověřte jej v nabídce u hodin.",
                    MessageBoxIcon.Warning);
            return;
        }

        if (force && !fromWeb)
            ShowUpdateBalloon("Zjišťuji dostupné aktualizace…");

        _checking = true;
        AdminControl.WriteStatus("checking", "Kontroluji dostupné verze na GitHubu.");
        try
        {
            _updateManager ??= CreateUpdateManager(_settings.UpdateFeedUrl);
            if (!_updateManager.IsInstalled)
            {
                _updateStatus.Text = "Aktualizace fungují po instalaci Setup.exe";
                AdminControl.WriteStatus("error", "Aplikace nebyla nainstalována pomocí Setup.exe.");
                EventLogFile.Write("Update check unavailable: application is not installed with Velopack.");
                if (force && !fromWeb)
                    ShowManualUpdateMessage("Aplikace neběží jako nainstalovaná verze Velopack. " +
                        "Pro automatické aktualizace použijte Setup.exe, ne Portable.zip.",
                        MessageBoxIcon.Warning);
                return;
            }

            var feedAtCheckStart = _settings.UpdateFeedUrl;
            var manager = _updateManager;
            _updateStatus.Text = "Zjišťuji aktualizace…";
            EventLogFile.Write($"Checking GitHub updates (manual={force}) from {feedAtCheckStart}");
            var latest = await manager.CheckForUpdatesAsync();
            if (_exiting || !string.Equals(feedAtCheckStart, _settings.UpdateFeedUrl, StringComparison.Ordinal))
                return;
            if (latest is null)
            {
                _pendingUpdate = null;
                _updateStatus.Text = "Aktuální verze je nejnovější";
                AdminControl.WriteStatus("up_to_date", "Používáte nejnovější dostupnou verzi.");
                EventLogFile.Write("Update check completed: already on the latest available release.");
                if (force && !fromWeb)
                    ShowManualUpdateMessage("Používáte nejnovější dostupnou verzi MSFS Companion. " +
                        "Žádná nová aktualizace momentálně není k dispozici.");
                return;
            }

            _updateStatus.Text = "Stahuji aktualizaci…";
            AdminControl.WriteStatus("downloading", "Stahuji novou verzi.", latest.TargetFullRelease.Version.ToString());
            EventLogFile.Write($"Update available: {latest.TargetFullRelease.Version}. Download starting.");
            if (force && !fromWeb)
                ShowUpdateBalloon($"Nalezena verze {latest.TargetFullRelease.Version}. Stahuji aktualizaci…");
            await manager.DownloadUpdatesAsync(latest);
            if (_exiting || !string.Equals(feedAtCheckStart, _settings.UpdateFeedUrl, StringComparison.Ordinal))
                return;

            _pendingUpdate = latest;
            _updateStatus.Text = "Aktualizace stažena";
            AdminControl.WriteStatus("downloaded", "Aktualizace stažena.", latest.TargetFullRelease.Version.ToString());
            EventLogFile.Write($"Downloaded version {latest.TargetFullRelease.Version}");
            if (_settings.AutomaticUpdates || force)
            {
                if (force && !fromWeb)
                    ShowUpdateBalloon("Aktualizace je stažena, MSFS Companion se nyní restartuje.");
                ApplyDownloadedUpdate();
            }
        }
        catch (Exception ex)
        {
            _updateStatus.Text = "Kontrola aktualizací se nezdařila (viz log)";
            AdminControl.WriteStatus("error", "Kontrola aktualizací selhala. Podrobnosti jsou v místním diagnostickém logu.");
            EventLogFile.Write($"Update check/download error: {ex}");
            if (force && !fromWeb)
                ShowManualUpdateMessage("Kontrolu aktualizací se nepodařilo dokončit. " +
                    "Podrobnosti najdete v nabídce „Otevřít diagnostický log“. " +
                    $"Typ chyby: {ex.GetType().Name}.", MessageBoxIcon.Error);
        }
        finally
        {
            _checking = false;
        }
    }

    private void ApplyDownloadedUpdate()
    {
        if (!UpdatePolicy.MayApply(_pendingUpdate is not null, _exiting, _applyingUpdate)
            || _updateManager is null)
            return;

        _applyingUpdate = true;
        try
        {
            // This shuts down *only* our own child process. FlightSimulator.exe is
            // neither inspected nor stopped. The web UI disconnects briefly and
            // reconnects automatically after the updated host starts.
            _healthTimer.Stop();
            _bridge.Stop();
            _icon.Visible = false;
            AdminControl.WriteStatus("applying", "Instaluji aktualizaci a restartuji MSFS Companion.");
            EventLogFile.Write("Applying Companion update; MSFS is left running.");
            _updateManager.ApplyUpdatesAndRestart(_pendingUpdate!);
            // Velopack schedules replacing our files and exits/restarts our host.
        }
        catch (Exception ex)
        {
            EventLogFile.Write($"Update apply failure: {ex}");
            _icon.Visible = true;
            _bridge.EnsureStarted();
            _healthTimer.Start();
            _updateStatus.Text = "Instalace aktualizace se nezdařila";
            _applyingUpdate = false;
        }
    }

    protected override void ExitThreadCore()
    {
        _exiting = true;
        _updateTimer.Stop();
        _webRequestTimer.Stop();
        _healthTimer.Stop();
        _icon.Visible = false;
        _bridge.Dispose();
        _icon.Dispose();
        _updateTimer.Dispose();
        _webRequestTimer.Dispose();
        _healthTimer.Dispose();
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !_exiting)
            ExitThreadCore();
        base.Dispose(disposing);
    }
}
