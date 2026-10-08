# B1 — MSFS 2020 SimConnect Compatibility Probe

The diagnostic project lives at `apps/probe` and **does not change simulator
settings**. It reads SimVars, optionally enumerates Input Events, and writes
a JSON report. It is separate from the web bridge (`apps/bridge`).

## How to get the executable

1. Open **Actions → SimConnect Probe (Windows)** in GitHub.
2. Open a successful run from the B1 PR (or use **Run workflow** after merge).
3. Download the **MSFS-Companion-SimConnect-Probe-win-x64** artifact.
4. Extract the ZIP into a folder on your Windows PC.
5. Keep all files in the folder together, including **SimConnect.dll**.

This is a self-contained .NET 10 Windows x64 build: you do not need VS Code,
Visual Studio or the .NET SDK on the simulator computer. The CI's offline
self-test does not establish actual simulator compatibility; that requires
testing on the Windows PC running MSFS 2020.

## Windows simulator test

1. Start MSFS 2020 and load an aircraft into a flight (Cessna 172 recommended).
2. Open PowerShell **in the extracted directory**.
3. Run:

```powershell
.\MsfsCompanion.Probe.exe --duration 30 --wait 90
```

4. Leave the flight running until collection finishes. The tool displays live
   IAS/ALT/HDG/VS/pitch/bank readings as they arrive.
5. The resulting report is written to:

```text
%USERPROFILE%\Documents\MSFS Companion\simconnect-report.json
```

   The tool also prints the exact absolute path.

6. Share the report for review. **It contains GPS coordinates and technical
   diagnostics**, so inspect it before sharing it publicly.

If MSFS is not running, the probe attempts reconnection until `--wait` expires
and writes a failure report. Restarting MSFS during the collection also causes
the probe to try again; failures and the number of connection attempts are recorded.

## Options

```text
--wait SECONDS           Startup connection wait (5–600, default 90)
--duration SECONDS       Telemetry collection window (5–300, default 30)
--report PATH            Change JSON output destination
--lvar L:KNOWN_NAME      Optional read of one known aircraft-specific LVar
--skip-input-events      Skip enumerating Input Events
--self-test              Test JSON reporting only, without simulator connection
--help                   Show all options
```

**LVars:** the probe does not invent LVar names. If a known LVar is supplied,
it attempts a read, but a zero value alone does not prove the variable exists.
Input Event enumeration is read-only; an error or timeout does not automatically
mean the MSFS 2020 installation lacks all Input Event support.

**Standard events:** no autopilot or radio commands are sent by the B1 probe.
Actual write-event compatibility belongs in a separate, explicitly confirmed
test after passive telemetry works.

## Build details and dependencies

- .NET 10, RID `win-x64`, self-contained publish.
- NuGet `SimConnect.NET` **0.2.2**, MIT-licensed C# wrapper.
- The package bundles the native Microsoft `SimConnect.dll`; CI checks its
  presence in the output. Review Microsoft SDK redistribution terms before
  publishing binaries outside private testing.
- The wrapper is beta; behavior must be confirmed against the user's installed
  MSFS 2020 version.
- Simulator read frequency is intentionally low. B1 validates connectivity and
  field units; B2 will use subscriptions and bounded update rates for PFD.

## JSON report schema

`schemaVersion: "simconnect-probe-v1"`, timestamps, simulator/connection
diagnostics, read-only feature checks, errors, and `samples` containing
latitude/longitude, IAS, ALT, VS, HDG, pitch, bank, and measured request latency.

An offline CI self-test emits `connection: "self_test_only"` and no samples.
Only Windows-with-simulator testing can produce real samples.
