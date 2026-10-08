# Windows automatic updates — development configuration

The Windows app is hosted by `apps/windows-host` and installed/upgraded by
Velopack. See the practical setup: [Windows installer and updates](WINDOWS_INSTALLER.md).

- **Repository:** public `Boym323/MSFS-Companion`.
- **Update feed:** public GitHub Releases of that same repository by default.
- **Publish:** after a successful Windows installer job on a push to `main`,
  automatically create `v0.2.<run_number>` release with the setup executable
  and Velopack update assets. No separate repo or user-supplied PAT.
- **Windows background app:** launches at sign-in, supervises the local bridge,
  checks for a new version at startup and hourly.
- **During MSFS:** checks, downloads and applies updates normally. The Windows
  simulator itself is never stopped; Companion/bridge restarts momentarily.
- **Manual CI dispatch / PR:** only produces downloadable artifacts; does not
  publish a public release.
- **Still required:** first real Windows installation test, a two-version update
  test and recovery/rollback validation. B2 SimConnect bridge integration remains
  a separate milestone. Development binaries are currently unsigned.

GitHub Actions may require write access to Releases; the privileged upload job
runs only on the default branch, after the package is built and tested.
