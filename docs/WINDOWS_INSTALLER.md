# Windows background app and automatic updates (V1)

## What you get

- A Windows x64 **MSFS Companion** app that lives in the notification area.
  Double-click the tray icon to open the local dashboard.
- Velopack per-user Setup installer, automatically started at **Windows login**
  via the installer-provided `Startup` shortcut. No scheduled task, service,
  admin login or SDK is needed after first installation.
- The tray app launches and supervises the packaged ASP.NET Core bridge as a
  hidden child process and restarts it if it exits unexpectedly.
- It checks for updates shortly after launch and hourly and applies them
  automatically **even while MSFS is running**. The game continues running,
  but the web dashboard/bridge disconnects briefly as Companion restarts.
- A `LocalAppData/MSFS Companion/settings.json` file stores the update feed,
  defaulting to this repository's GitHub Releases.
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

## Automatic updates from public GitHub Releases

The source repository **Boym323/MSFS-Companion is public**. The Windows app
uses GitHub Releases in this **same repository** as its default update channel:

`https://github.com/Boym323/MSFS-Companion`

No second updates repository, GitHub personal access token or Windows client
credentials are required.

### Normal development workflow

1. Make a change on a feature branch and open a pull request.
2. After review and successful CI, merge it to `main`.
3. The **Windows tray installer** workflow builds the full application
   and automatically publishes a new numbered GitHub Release, such as
   `v0.2.37`. Each run on `main` uses an increasing Actions run number.
4. The installed tray application checks the public release feed shortly
   after launch and then hourly. If a newer version exists it downloads
   and applies the update without manual interaction.
5. Updating is permitted **while MSFS 2020 is running**. Only our own
   Companion host and its bridge restart; `FlightSimulator.exe` is never
   terminated or sent controls. Connected PFD/dashboard clients may
   disconnect briefly and automatically reconnect.

The publish step runs in a separate CI job with narrowly scoped
`GITHUB_TOKEN` **Contents: write** permissions, on `main` push only,
and after successful Windows build/tests. Pull requests and manual
`workflow_dispatch` builds create installer artifacts but **never publish**.
Ensure GitHub Actions permissions permit creating Releases, otherwise this
job will fail and the release will not be available to clients.

A custom HTTPS update endpoint remains configurable in the tray, but
is not required. The update feed defaults to the public source above.

### Development release risks

These are **unsigned development installers and releases**. Windows SmartScreen
may warn, and Windows Defender or company policies may block execution.
Public GitHub releases make the binaries downloadable by anyone.
Review downloaded releases and use only on machines you control.
A broken update can still take the Companion offline: the current
version has **no automatic health-gated rollback**. Test the first
installation and at least one real version-to-version update on Windows
before treating unattended updates as production-ready.

### Recovery

If a newer version fails, reinstall the last known-good `Setup.exe` and
keep a backup of it; the initial V1 does **not** implement an automated
health-gated rollback. Do not enable an unattended rollout to other
computers until a tested upgrade and recovery cycle has passed.

### Diagnostic test

`MsfsCompanion.WindowsHost.exe --self-test` checks the update policy
(including permission to apply during MSFS) and default GitHub feed and exits immediately. It does not launch any simulator.
Windows GitHub Actions also builds the production frontend and packages
the updater. No real Windows login/session or second-version upgrade is
exercised in Actions.

Reference: [Velopack Windows packaging](https://docs.velopack.io/packaging/operating-systems/windows),
[updates](https://docs.velopack.io/integrating/overview),
[shortcuts](https://docs.velopack.io/integrating/shortcuts).
