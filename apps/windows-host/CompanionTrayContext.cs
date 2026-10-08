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
        menu.Items.Add(new ToolStripMenuItem("Otevřít diagnostický log", null, (_, _) =>
            Process.Start(new ProcessStartInfo("notepad.exe", $"\"{EventLogFile.PathOnDisk}\"") { UseShellExecute = true })));
        menu.Items.Add(new ToolStripMenuItem("Ukončit MSFS Companion", null, (_, _) => ExitThread()));

        _icon = new NotifyIcon
        {
            Icon = SystemIcons.Application,
            Text = "MSFS Companion – běží na pozadí",
            Visible = true,
            ContextMenuStrip = menu
        };
        _icon.DoubleClick += (_, _) => OpenDashboard();

        _bridge.EnsureStarted();

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

    private async Task CheckUpdatesAsync(bool force = false)
    {
        if (_checking || _applyingUpdate || _exiting || (!_settings.AutomaticUpdates && !force))
            return;

        if (string.IsNullOrWhiteSpace(_settings.UpdateFeedUrl))
        {
            _updateStatus.Text = "Aktualizace: nastavte HTTPS zdroj";
            return;
        }

        _checking = true;
        try
        {
            _updateManager ??= CreateUpdateManager(_settings.UpdateFeedUrl);
            if (!_updateManager.IsInstalled)
            {
                _updateStatus.Text = "Aktualizace fungují po instalaci Setup.exe";
                return;
            }

            var feedAtCheckStart = _settings.UpdateFeedUrl;
            var manager = _updateManager;
            _updateStatus.Text = "Zjišťuji aktualizace…";
            var latest = await manager.CheckForUpdatesAsync();
            if (_exiting || !string.Equals(feedAtCheckStart, _settings.UpdateFeedUrl, StringComparison.Ordinal))
                return;
            if (latest is null)
            {
                _pendingUpdate = null;
                _updateStatus.Text = "Aktuální verze je nejnovější";
                return;
            }

            _updateStatus.Text = "Stahuji aktualizaci…";
            await manager.DownloadUpdatesAsync(latest);
            if (_exiting || !string.Equals(feedAtCheckStart, _settings.UpdateFeedUrl, StringComparison.Ordinal))
                return;

            _pendingUpdate = latest;
            _updateStatus.Text = "Aktualizace stažena";
            EventLogFile.Write($"Downloaded version {latest.TargetFullRelease.Version}");
            if (_settings.AutomaticUpdates || force)
                ApplyDownloadedUpdate();
        }
        catch (Exception ex)
        {
            _updateStatus.Text = "Kontrola aktualizací se nezdařila (viz log)";
            EventLogFile.Write($"Update check/download error: {ex}");
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
        _healthTimer.Stop();
        _icon.Visible = false;
        _bridge.Dispose();
        _icon.Dispose();
        _updateTimer.Dispose();
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
