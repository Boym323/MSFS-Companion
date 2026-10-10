using System.Diagnostics;
using System.Drawing;
using Velopack;
using Velopack.Sources;

namespace MsfsCompanion.WindowsHost;

internal sealed class CompanionTrayContext : ApplicationContext
{
    private readonly NotifyIcon _icon;
    private readonly BridgeProcess _bridge;
    private readonly CompanionMdnsPublisher _mdns = new();
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
    private bool _verifyingUpdate;
    private DateTimeOffset _nextA320ModuleCheck = DateTimeOffset.MinValue;

    public CompanionTrayContext()
    {
        _bridge = new BridgeProcess(() => _settings.TelemetryMode, () => _settings.MdnsEnabled, () => _settings.MdnsName);
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

        var sourceMenu = new ToolStripMenuItem("Zdroj letových dat");
        var liveSource = new ToolStripMenuItem("SimConnect – skutečný MSFS")
        {
            Checked = _settings.TelemetryMode == "simconnect"
        };
        var mockSource = new ToolStripMenuItem("Mock – testovací hodnoty")
        {
            Checked = _settings.TelemetryMode == "mock"
        };
        void SelectSource(string mode)
        {
            if (_settings.TelemetryMode == mode || _exiting || _applyingUpdate)
                return;

            _settings.TelemetryMode = mode;
            _settings.Save();
            liveSource.Checked = mode == "simconnect";
            mockSource.Checked = mode == "mock";
            // Jen náš bridge se krátce restartuje, nikoli MSFS.
            _bridge.Stop();
            _bridge.EnsureStarted();
            EventLogFile.Write($"Zdroj telemetrie změněn na {mode}.");
        }
        liveSource.Click += (_, _) => SelectSource("simconnect");
        mockSource.Click += (_, _) => SelectSource("mock");
        sourceMenu.DropDownItems.Add(liveSource);
        sourceMenu.DropDownItems.Add(mockSource);
        menu.Items.Add(sourceMenu);
        menu.Items.Add(new ToolStripSeparator());
        var mdnsToggle = new ToolStripMenuItem($"mDNS: {_settings.MdnsHostName}")
        {
            Checked = _settings.MdnsEnabled,
            CheckOnClick = true
        };
        mdnsToggle.CheckedChanged += (_, _) =>
        {
            if (_exiting || _applyingUpdate) return;
            _settings.MdnsEnabled = mdnsToggle.Checked;
            _settings.Save();
            _mdns.Stop();
            _bridge.Stop();
            _bridge.EnsureStarted();
            _mdns.Refresh(_settings.MdnsEnabled, _settings.MdnsName, _bridge.BoundLan ?? LanAccess.Find(), _bridge.IsRunning);
        };
        menu.Items.Add(mdnsToggle);
        menu.Items.Add(new ToolStripMenuItem("Změnit mDNS název…", null, (_, _) =>
        {
            if (!ConfigureMdnsName()) return;
            mdnsToggle.Text = $"mDNS: {_settings.MdnsHostName}";
        }));
        var mdnsStatus = new ToolStripMenuItem("mDNS: načítám…") { Enabled = false };
        menu.Items.Add(mdnsStatus);
        // WASM Community installation is a local Windows action only.
        // Initial activation is opt-in; subsequent upgrades keep the opt-in.
        var a320Menu = new ToolStripMenuItem("Modul původního Asobo A320neo");
        var a320Status = new ToolStripMenuItem("Kontroluji modul…") { Enabled = false };
        a320Menu.DropDownItems.Add(a320Status);
        a320Menu.DropDownItems.Add(new ToolStripMenuItem(
            "Nainstalovat / aktualizovat modul…", null,
            (_, _) => ConfigureA320Module()));
        a320Menu.DropDownItems.Add(new ToolStripMenuItem("Odinstalovat modul…", null,
            (_, _) => UninstallA320Module()));
        a320Menu.DropDownOpening += (_, _) =>
        {
            var folder = A320CommunityFolder();
            a320Status.Text = A320ModuleInstaller.Status(folder);
        };
        menu.Items.Add(a320Menu);

        menu.Items.Add(_updateStatus);
        menu.Items.Add(new ToolStripMenuItem("Zkontrolovat aktualizace", null, async (_, _) => await CheckUpdatesAsync(force: true)));
        menu.Items.Add(_automaticUpdates);
        var recoveryWatchToggle=new ToolStripMenuItem("Automatický návrat při pádu aktualizace (experimentální)")
        {
            Checked=_settings.EnableRecoveryWatchdog,CheckOnClick=true
        };
        recoveryWatchToggle.CheckedChanged+=(_,_)=>
        {
            if(_applyingUpdate||_verifyingUpdate||_exiting)
            {
                recoveryWatchToggle.Checked=_settings.EnableRecoveryWatchdog;
                return;
            }
            if(recoveryWatchToggle.Checked &&
                MessageBox.Show("Tato funkce je experimentální a nebyla dosud ověřena na " +
                    "úmyslně poškozené instalaci. Při neúspěšném startu nového hostitele " +
                    "může automaticky instalovat předchozí uloženou verzi. " +
                    "Aktivovat pouze pro testování na vlastním počítači?",
                    "Experimentální obnova",MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning)!=DialogResult.Yes)
            {
                recoveryWatchToggle.Checked=false;
                return;
            }
            _settings.EnableRecoveryWatchdog=recoveryWatchToggle.Checked;
            _settings.Save();
        };
        menu.Items.Add(recoveryWatchToggle);
        menu.Items.Add(new ToolStripMenuItem("Obnovit předchozí verzi (pokročilé)…", null,
            (_, _) => RestorePreviousPackage()));
        menu.Items.Add(new ToolStripMenuItem("Nastavit aktualizační zdroj…", null, (_, _) => ConfigureUpdateFeed()));
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add(new ToolStripMenuItem("Zkopírovat adresu MSFS Companion v LAN", null, (_, _) =>
        {
            var lan = _bridge.BoundLan ?? LanAccess.Find();
            if (lan is null)
            {
                MessageBox.Show("Nebyla nalezena privátní IPv4 adresa Wi-Fi nebo Ethernetu. " +
                    "Zkontrolujte připojení počítače k domácí síti.",
                    "MSFS Companion", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            var url = _mdns.Active ? _mdns.DashboardUrl : lan.DashboardUrl;
            Clipboard.SetText(url);
            MessageBox.Show($"Adresa pro Mac, iPad a ostatní zařízení v domácí síti byla zkopírována:\n{url}\nZáložní IP adresa: {lan.DashboardUrl}",
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
        var pendingJournal = UpdateRecoveryJournal.Load();
        if (UpdateRecoveryJournal.NeedsQuarantine(UpdateRecoveryJournal.HasPendingAttempt(), pendingJournal))
        {
            // Poškozený, neplatný nebo zastaralý journal není úspěšná aktualizace.
            // Vyžadujeme vědomé opětovné povolení automatických aktualizací.
            _settings.AutomaticUpdates = false;
            _settings.Save();
            _automaticUpdates.Checked = false;
            _pendingUpdate = null;
            UpdateRecoveryJournal.MarkFailed();
            _updateStatus.Text = "Neověřená aktualizace – automatické aktualizace vypnuty";
            AdminControl.WriteStatus("error", "Nelze ověřit záznam aktualizace. Další aktualizace jsou pozastaveny.");
            EventLogFile.Write("C33: neplatný pending journal; aktualizace pozastaveny.");
        }
        _verifyingUpdate = pendingJournal is not null;
        if (_verifyingUpdate) _ = VerifyUpdatedHostAsync();
        _mdns.Refresh(_settings.MdnsEnabled, _settings.MdnsName, _bridge.BoundLan ?? LanAccess.Find(), _bridge.IsRunning);

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
        _healthTimer.Tick += (_, _) =>
        {
            _bridge.EnsureStarted();
            _mdns.Refresh(_settings.MdnsEnabled, _settings.MdnsName, _bridge.BoundLan ?? LanAccess.Find(), _bridge.IsRunning);
            CheckA320ModuleUpdate();
        };
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


    private string? A320CommunityFolder()
    {
        return A320ModuleInstaller.ValidCommunity(_settings.A320CommunityPath)
            ? _settings.A320CommunityPath : A320ModuleInstaller.DetectCommunity();
    }

    private void ConfigureA320Module()
    {
        if (_exiting || _applyingUpdate || _verifyingUpdate) return;
        if (A320ModuleInstaller.SimulatorRunning())
        {
            MessageBox.Show("Nejdříve ukončete MSFS 2020. Instalace modulu do Community během letu není bezpečná.",
                "Modul Airbus A320neo", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        var folder = A320CommunityFolder();
        if (folder is null)
        {
            using var dialog = new FolderBrowserDialog
            {
                Description = "Vyberte existující složku Community pro MSFS 2020.",
                ShowNewFolderButton = false
            };
            if (dialog.ShowDialog() != DialogResult.OK) return;
            folder = dialog.SelectedPath;
        }
        if (!A320ModuleInstaller.ValidCommunity(folder))
        {
            MessageBox.Show("Vybraná složka musí být existující a nepřesměrovaná Community.",
                "Modul Airbus A320neo", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }
        if (MessageBox.Show(
            "Kokpit nainstaluje pouze vlastní balíček kokpit-asobo-a320-v1 do:\n\n" +
            folder + "\n\n" +
            "Souhlasíte také s automatickými aktualizacemi tohoto modulu při aktualizaci Kokpitu, " +
            "výhradně když MSFS není spuštěný?\n\n" +
            "Cizí balíčky nebudou měněny.",
            "Povolit instalaci modulu A320neo", MessageBoxButtons.YesNo,
            MessageBoxIcon.Question) != DialogResult.Yes) return;

        if (A320ModuleInstaller.Install(folder, out var message))
        {
            _settings.A320ModuleAutoUpdates = true;
            _settings.A320CommunityPath = folder;
            _settings.Save();
            _nextA320ModuleCheck = DateTimeOffset.UtcNow.AddMinutes(5);
            EventLogFile.Write("Asobo A320 module installation accepted: " + message);
            MessageBox.Show(message, "Modul Airbus A320neo",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        else
        {
            EventLogFile.Write("Asobo A320 module installation rejected: " + message);
            MessageBox.Show(message, "Modul Airbus A320neo",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
    }

    private void UninstallA320Module()
    {
        if (_exiting || _applyingUpdate || _verifyingUpdate) return;
        var folder = A320CommunityFolder();
        if (folder is null) return;
        if (MessageBox.Show("Odinstalovat pouze balíček Kokpitu " +
            A320ModuleInstaller.PackageName + " ze složky Community?\n" +
            "Automatické aktualizace modulu se zároveň vypnou.",
            "Odinstalace modulu A320", MessageBoxButtons.YesNo,
            MessageBoxIcon.Question) != DialogResult.Yes) return;
        if (A320ModuleInstaller.Uninstall(folder, out var message))
        {
            _settings.A320ModuleAutoUpdates = false;
            _settings.Save();
            EventLogFile.Write("Asobo A320 module uninstalled at user request.");
            MessageBox.Show(message, "Modul Airbus A320neo",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        else MessageBox.Show(message, "Modul Airbus A320neo",
            MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private void CheckA320ModuleUpdate()
    {
        if (!_settings.A320ModuleAutoUpdates || _exiting ||
            _applyingUpdate || _verifyingUpdate ||
            DateTimeOffset.UtcNow < _nextA320ModuleCheck) return;
        // One check after startup and every five minutes. While MSFS runs,
        // updates remain deferred without any simulator/bridge restart.
        _nextA320ModuleCheck = DateTimeOffset.UtcNow.AddMinutes(5);
        if (A320ModuleInstaller.SimulatorRunning()) return;
        var folder = A320CommunityFolder();
        if (folder is null) return;
        if (A320ModuleInstaller.Status(folder) == "Modul je aktuální.") return;
        if (A320ModuleInstaller.Install(folder, out var message))
            EventLogFile.Write("Asobo A320 module maintenance: " + message);
        else
            EventLogFile.Write("Asobo A320 module maintenance deferred: " + message);
    }

    private static void OpenDashboard()
    {
        Process.Start(new ProcessStartInfo("http://127.0.0.1:8765/admin")
        {
            UseShellExecute = true
        });
    }

    private bool ConfigureMdnsName()
    {
        if (_exiting || _applyingUpdate)
            return false;

        using var form = new Form
        {
            Text = "Lokální mDNS název – MSFS Companion",
            Width = 505,
            Height = 208,
            StartPosition = FormStartPosition.CenterScreen,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MinimizeBox = false,
            MaximizeBox = false,
            ShowInTaskbar = true
        };
        var help = new Label
        {
            Text = "Zvolte název bez .local (např. kokpit nebo letadlo-2).",
            AutoSize = true, Left = 16, Top = 16
        };
        var input = new TextBox { Left = 16, Top = 47, Width = 350, Text = _settings.MdnsName, MaxLength = 63 };
        var suffix = new Label { Text = ".local", Left = 377, Top = 51, AutoSize = true };
        var save = new Button { Text = "Uložit", Left = 255, Top = 105, Width = 100, DialogResult = DialogResult.OK };
        var cancel = new Button { Text = "Zrušit", Left = 365, Top = 105, Width = 100, DialogResult = DialogResult.Cancel };
        form.Controls.AddRange([help, input, suffix, save, cancel]);
        form.AcceptButton = save;
        form.CancelButton = cancel;
        if (form.ShowDialog() != DialogResult.OK)
            return false;

        if (!HostSettings.TryNormalizeMdnsName(input.Text, out var normalized, out var error))
        {
            MessageBox.Show(error, "Neplatný mDNS název", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return false;
        }
        if (_settings.MdnsName == normalized)
            return false;

        _settings.MdnsName = normalized;
        _settings.Save();
        if (_settings.MdnsEnabled)
        {
            _mdns.Stop();
            _bridge.Stop();
            _bridge.EnsureStarted();
            _mdns.Refresh(true, _settings.MdnsName, _bridge.BoundLan ?? LanAccess.Find(), _bridge.IsRunning);
        }
        EventLogFile.Write($"mDNS hostname changed to {_settings.MdnsHostName}");
        return true;
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
        if (_verifyingUpdate) return; // Neopakovat update před ověřením nového hostitele.
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

    /// <summary>
    /// Aktualizace je potvrzena teprve po lokálním HTTP health a web smoke.
    /// V případě selhání vypneme budoucí automatické aktualizace, nikoliv
    /// automaticky neověřeně manipulujeme s instalací.
    /// </summary>
    private bool IsExpectedVersionInstalled(string targetVersion)
    {
        try
        {
            // Čtení verze z lokální instalace Velopack; žádný HTTP request.
            // Nepoužíváme AssemblyVersion (v csproj zůstává konstantní).
            var manager = CreateUpdateManager(HostSettings.DefaultFeedUrl);
            var installedVersion = manager.IsInstalled ? manager.CurrentVersion?.ToString() : null;
            if (!UpdateRecoveryJournal.MatchesTargetVersion(targetVersion, installedVersion))
            {
                EventLogFile.Write($"C33: očekávaná verze {targetVersion}, lokálně nalezena {installedVersion ?? "neznámá"}.");
                return false;
            }
            return true;
        }
        catch (Exception ex)
        {
            EventLogFile.Write("C33: verzi instalace nelze potvrdit: " + ex.GetType().Name);
            return false;
        }
    }

    private async Task VerifyUpdatedHostAsync()
    {
        var pending = UpdateRecoveryJournal.Load();
        var expectedVersionInstalled = pending is not null &&
            IsExpectedVersionInstalled(pending.TargetVersion);
        using var handler=new HttpClientHandler { UseProxy=false };
        using var client=new HttpClient(handler) { Timeout=TimeSpan.FromSeconds(3) };
        var healthy=false;
        for(var attempt=0;attempt<10&&!_exiting&&expectedVersionInstalled;attempt++)
        {
            try
            {
                using var a=await client.GetAsync("http://127.0.0.1:8765/api/health/overview");
                using var b=await client.GetAsync("http://127.0.0.1:8765/admin");
                if(a.IsSuccessStatusCode && b.IsSuccessStatusCode)
                {
                    healthy=true; break;
                }
            }
            catch(HttpRequestException) { /* bridge se teprve spouští */ }
            catch(TaskCanceledException) { /* krátký health timeout */ }
            if(attempt<9)await Task.Delay(3000);
        }
        if (_exiting)return;
        if (healthy)
        {
            UpdateRecoveryJournal.Confirm();
            EventLogFile.Write("C33: start po aktualizaci potvrzen health + web.");
        }
        else
        {
            _settings.AutomaticUpdates=false;
            _settings.Save();
            _automaticUpdates.Checked=false;
            _pendingUpdate=null;
            UpdateRecoveryJournal.MarkFailed();
            _updateStatus.Text="Po aktualizaci selhala kontrola webu – automatické aktualizace vypnuty";
            AdminControl.WriteStatus("error",
                "Po aktualizaci selhal lokální smoke test. Další aktualizace jsou pozastaveny.");
            EventLogFile.Write(expectedVersionInstalled
                ? "C33: health/web test selhal; aktualizace pozastaveny, rollback není dostupný."
                : "C33: verze po aktualizaci nebyla potvrzena; aktualizace pozastaveny, rollback není dostupný.");
            ShowUpdateBalloon("Po aktualizaci nebyl potvrzen web. Automatické aktualizace pozastaveny.",
                ToolTipIcon.Warning);
        }
        _verifyingUpdate=false;
    }

    private void RestorePreviousPackage()
    {
        if(_applyingUpdate||_checking||_verifyingUpdate||_exiting){
            MessageBox.Show("Dokončete nejprve ověřování nebo aktualizaci.",
                "MSFS Companion",MessageBoxButtons.OK,MessageBoxIcon.Information);
            return;
        }
        var package=RecoveryPackageCache.VerifiedPackage();
        var updater=RecoveryPackageCache.LocalUpdater();
        if(package is null||updater is null)
        {
            MessageBox.Show("Není dostupný integritně ověřený lokální balíček starší verze. " +
                "Obnova tímto způsobem není možná; použijte ruční instalátor GitHub Releases.",
                "MSFS Companion",MessageBoxButtons.OK,MessageBoxIcon.Warning);
            return;
        }
        if(MessageBox.Show("Chcete obnovit poslední uložený balíček předchozí verze? "+
            "Ověřil se jeho SHA-256, ale samotná instalace staré verze zatím nebyla "+
            "validována při úmyslném pádu v MSFS. Aplikace Companion se restartuje, "+
            "simulátor zůstane spuštěný. Automatické aktualizace se vypnou.",
            "Obnova MSFS Companion",MessageBoxButtons.YesNo,MessageBoxIcon.Warning)!=DialogResult.Yes)
            return;
        try
        {
            var process=new ProcessStartInfo(updater)
            {
                UseShellExecute=false,
                WorkingDirectory=Path.GetDirectoryName(updater)!
            };
            process.ArgumentList.Add("apply");
            process.ArgumentList.Add("--package");
            process.ArgumentList.Add(package);
            process.ArgumentList.Add("--waitPid");
            process.ArgumentList.Add(Environment.ProcessId.ToString());
            if(Process.Start(process) is null)throw new IOException("Updater did not start");
            _settings.AutomaticUpdates=false;
            _settings.Save();
            _automaticUpdates.Checked=false;
            EventLogFile.Write("C42: user invoked manually supervised offline recovery.");
            _bridge.Stop();
            ExitThread();
        }
        catch(Exception ex)
        {
            EventLogFile.Write("C42 manual recovery failed: "+ex.GetType().Name);
            MessageBox.Show("Obnova se nespustila. Stávající verze zůstává zachována.",
                "MSFS Companion",MessageBoxButtons.OK,MessageBoxIcon.Error);
        }
    }

    private void ApplyDownloadedUpdate()
    {
        if (!UpdatePolicy.MayApply(_pendingUpdate is not null, _exiting, _applyingUpdate)
            || _updateManager is null)
            return;

        // Capture provenance before handing control to Velopack; the last
        // installed version is not a rollback-capable binary snapshot.
        var previousVersion = _updateManager.IsInstalled
            ? _updateManager.CurrentVersion?.ToString() : null;
        // Capture even for manual recovery, but never silently degrade an
        // explicitly enabled watchdog into an unprotected update.
        if(previousVersion is not null &&
            !RecoveryPackageCache.TryCapture(previousVersion))
            EventLogFile.Write("C42: no freshly captured rollback package found.");
        var matchingPackage=previousVersion is not null &&
            RecoveryPackageCache.VerifiedPackageForVersion(previousVersion) is not null;
        if(!UpdatePolicy.RecoveryRequirementMet(_settings.EnableRecoveryWatchdog,
            previousVersion,matchingPackage))
        {
            _updateStatus.Text="Aktualizace pozastavena – není dostupná bezpečná obnova";
            AdminControl.WriteStatus("error",
                "Watchdog je zapnutý, ale chybí ověřená předchozí verze. "+
                "Aktualizace neproběhla; vypněte experimentální watchdog nebo "+
                "obnovte místní balíček.");
            EventLogFile.Write("C42: protected update blocked: no matching rollback package.");
            return;
        }
        var targetVersion=_pendingUpdate!.TargetFullRelease.Version.ToString();
        if(!UpdateRecoveryJournal.TryArm(targetVersion,previousVersion))
        {
            _updateStatus.Text="Nelze vytvořit bezpečnostní záznam aktualizace";
            AdminControl.WriteStatus("error","Aktualizaci nelze bezpečně zaznamenat.");
            EventLogFile.Write("C33: update blocked because journal cannot be armed.");
            return;
        }
        if(_settings.EnableRecoveryWatchdog)
        {
            // RecoveryRequirementMet guarantees that this version is non-null
            // and has a SHA-256-checked matching full package.
            if(previousVersion is null ||
                !RecoveryPackageCache.TryStartSupervisor(targetVersion,previousVersion))
            {
                var canceled=previousVersion is not null &&
                    UpdateRecoveryJournal.CancelBeforeApply(targetVersion,previousVersion);
                _updateStatus.Text="Aktualizace pozastavena – watchdog se nespustil";
                AdminControl.WriteStatus("error",
                    "Aktualizace nebyla použita: požadovaný obnovovací proces se "+
                    "nepodařilo spustit. "+(canceled?"":"Zkontrolujte update journal."));
                EventLogFile.Write("C42: protected update blocked: watchdog failed to start; journalCanceled="+canceled);
                return;
            }
        }
        _applyingUpdate = true;
        try
        {
            // This shuts down *only* our own child process. FlightSimulator.exe is
            // neither inspected nor stopped. The web UI disconnects briefly and
            // reconnects automatically after the updated host starts.
            _healthTimer.Stop();
            _mdns.Stop();
            _bridge.Stop();
            _icon.Visible = false;
            AdminControl.WriteStatus("applying", "Instaluji aktualizaci a restartuji MSFS Companion.");
            EventLogFile.Write("Applying Companion update; MSFS is left running.");
            _updateManager.ApplyUpdatesAndRestart(_pendingUpdate!);
            // Velopack schedules replacing our files and exits/restarts our host.
        }
        catch (Exception ex)
        {
            UpdateRecoveryJournal.MarkFailed();
            EventLogFile.Write($"Update apply failure: {ex}");
            _icon.Visible = true;
            _bridge.EnsureStarted();
            _mdns.Refresh(_settings.MdnsEnabled, _settings.MdnsName, _bridge.BoundLan ?? LanAccess.Find(), _bridge.IsRunning);
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
        _mdns.Dispose();
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
