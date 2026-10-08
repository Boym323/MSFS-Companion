# Windows automatic updates — proposal for B1.1

**This is an architecture plan, not an installed updater.** The current B1 probe
is a portable self-contained ZIP uploaded to private GitHub Actions artifacts.

## Future production release pipeline

1. CI builds the Windows bridge/tray application (not the disposable B1 probe),
   runs tests and publishes a versioned immutable release.
2. Package the application with **Velopack**. Sign the Windows executable,
   installer, update packages and feed metadata according to the chosen
   distribution scheme, with verification before applying updates.
3. At startup, or once a day while running, check the configured **stable**
   HTTPS update channel. Allow manual **Check for updates** in tray/admin.
4. Download and verify the update in the background. After a safe point
   (not while a critical cockpit command is in progress), notify the user and
   replace the binaries **after the process exits**.
5. On next startup, run a health check and provide a way to restore a known
   working previous version. Test interruption and recovery behavior before
   enabling unattended installation.
6. For beta builds, offer a separate opt-in prerelease channel.

## Private repository: never embed GitHub credentials

Velopack's GitHub source requires a GitHub access token for **private**
repositories. Do **not** bundle a personal access token, GitHub Actions token
or long-lived release URL in an end-user binary.

Choose one distribution model before implementing B1.1:

- **Public binaries, private source:** publish only approved/signed update assets
  to a dedicated public downloads repository or HTTPS static feed.
- **Private binaries:** authenticated update gateway that issues time-limited
  download URLs after device/user authentication. Build secrets live only
  in CI/server, never in distributed executables.

Download URLs must use HTTPS. Supply-chain review, release-asset integrity,
Windows code signing and installer UX are separate acceptance criteria.

Velopack documentation: https://docs.velopack.io/integrating/update-sources

**No auto-update for portable probe ZIP:** keep B1 deterministic, easy to
reproduce, and avoid replacing the diagnostic while a simulator test is running.
