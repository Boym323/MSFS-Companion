# Windows background app and automatic updates (V1)

## What you get

- A Windows x64 **MSFS Companion** app that lives in the notification area.
  Double-click the tray icon to open the local dashboard.
- Velopack per-user Setup installer, automatically started at **Windows login**
  via the installer-provided `Startup` shortcut. No scheduled task, service,
  admin login or SDK is needed after first installation.
- The tray app launches and supervises the packaged ASP.NET Core bridge as a
  hidden child process and restarts it if it exits unexpectedly.
- It checks for updates at launch and hourly, downloads them in the background,
  and applies them **only when neither FlightSimulator.exe nor
  FlightSimulator2024.exe is running**. If the simulator is running, it defers
  checks/installations. The safety check is repeated before applying.
- A `LocalAppData/MSFS Companion/settings.json` file stores the update feed.
  Logs are at `LocalAppData/MSFS Companion/windows-host.log`.
- A read-only dashboard runs locally at `http://127.0.0.1:8765/admin`.
  Remote iPad/Mac access is **not yet enabled**: LAN authentication belongs to B2.

### Install the first version

1. Open GitHub Actions → **Windows tray installer**.
2. Download the `MSFS-Companion-Windows-Installer` artifact from a successful run.
3. Run the contained `*Setup*.exe` on your Windows simulator PC.
4. After install, MSFS Companion starts in the tray. Right-click the icon
   for status, dashboard, manual update check, and update feed configuration.
5. A new **Windows login** automatically starts it from now on.

The diagnostic B1 `MsfsCompanion.Probe.exe` remains separate from this
persistent tray/bridge app. B2 will replace mock telemetry with SimConnect.

## Automatic update distribution — one-time setup required

The source repository `Boym323/MSFS-Companion` is **private**. Windows
clients cannot anonymously fetch its Actions artifacts or releases.
**Never put a PAT or GitHub Actions token into a Windows installer.**

Recommended distribution:

1. Create a separate **public** GitHub repository, e.g.
   `Boym323/MSFS-Companion-Updates`, containing only approved binary releases.
   The source repo can remain private. Public repo means binaries are public,
   not the source code. Do not publish secret configuration files.
2. Sign installer and packages and vet dependency/supply-chain provenance
   before wider distribution (current CI builds are **unsigned**).
3. Publish the Velopack `staging/releases` outputs through a consistent
   `win` release channel using the documented `vpk upload github`
   workflow; keep prior releases for recovery. Protect the publishing token
   as a GitHub Actions secret **only on the CI side** with least permissions,
   never in app or repo files.
4. In the tray menu select **Nastavit aktualizační zdroj…** and enter:
   `https://github.com/Boym323/MSFS-Companion-Updates`.
   The app uses `GithubSource` anonymously for a public repo.
5. Future approved stable releases will be detected/downloaded and installed
   automatically at the first safe opportunity, without interrupting MSFS.

A plain HTTPS static Velopack `releases.win.json` feed is also supported
through the same menu.

**Important:** This PR implements the *installer, tray runtime and client-side
update logic*, plus a private Actions build artifact. Public update hosting,
CI publishing credentials, Windows code signing, two-version update/rollback
acceptance test and real PC install remain separate release prerequisites.
Until a valid feed exists, the app still runs the dashboard automatically, but
can't download new versions. It never substitutes private repo credentials.

### Recovery

If a newer version fails, reinstall the last known-good `Setup.exe` and
keep a backup of it; the initial V1 does **not** implement an automated
health-gated rollback. Do not enable an unattended rollout to other
computers until a tested upgrade and recovery cycle has passed.

### Diagnostic test

`MsfsCompanion.WindowsHost.exe --self-test` checks the update safety
decision matrix and exits immediately. It does not launch any simulator.
Windows GitHub Actions also builds the production frontend and packages
the updater. No real Windows login/session or second-version upgrade is
exercised in Actions.

Reference: [Velopack Windows packaging](https://docs.velopack.io/packaging/operating-systems/windows),
[updates](https://docs.velopack.io/integrating/overview),
[shortcuts](https://docs.velopack.io/integrating/shortcuts).
