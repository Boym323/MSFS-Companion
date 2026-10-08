# Windows automatic updates

The original B1.1 design is now implemented as a **Windows tray host plus
Velopack installer/update client** (see the active branch/PR for details).

**Current setup and testing guide:**
[Windows installer and unattended updates](WINDOWS_INSTALLER.md)

## Status / remaining release requirements

- Windows tray and bridge process manager, login autostart: implemented.
- Version checking, downloading and deferring apply while MSFS runs: implemented.
- Velopack Setup.exe + package artifacts via Windows GitHub Actions: implemented.
- Optional gated publishing to a separate public binary-only GitHub repo:
  workflow implemented, **not yet configured/activated**.
- Production code signing: not yet configured.
- Real Windows installation and two-version upgrade/rollback verification:
  not yet completed.
- Backend still runs mock telemetry; B2 SimConnect bridge is separate.

Do not ship automatic release updates before the first real-PC installation,
update and recovery tests have passed. The app never stores GitHub PATs.
