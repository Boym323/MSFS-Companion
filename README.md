# MSFS Companion

Modern web-based cockpit companion for **Microsoft Flight Simulator 2020**.

> **Foundation V1:** Local read-only bridge with simulated telemetry and a React diagnostics dashboard.
> Real SimConnect integration, network pairing and cockpit controls are planned, not implemented.

## Prerequisites

- .NET 10 SDK
- Node.js 22.12+ (Node.js 24 LTS recommended)
- Git

Works on macOS, Linux and Windows in **mock mode**. SimConnect support will target Windows.

## Run locally

Open two terminals at the repository root.

Terminal 1 — bridge (http://127.0.0.1:8765):

```bash
dotnet run --project apps/bridge
```

Terminal 2 — React/Vite (http://127.0.0.1:5173):

```bash
cd apps/web
npm install
npm run dev
```

Open **http://127.0.0.1:5173/admin**.

Vite proxies `/api` and `/ws` to the local bridge. The dashboard
reconnects automatically if the bridge is restarted.

## Verify the backend

```bash
curl http://127.0.0.1:8765/api/status
curl http://127.0.0.1:8765/api/telemetry
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

The smoke test requires the running bridge and verifies live HTTP/WebSocket
telemetry, data updates, and that command APIs are not exposed. GitHub Actions
runs it automatically following the .NET build.

## Repository

```text
apps/
  bridge/   ASP.NET Core, telemetry source and read-only WebSocket
  web/      React, TypeScript and Vite dashboard
tests/      Runtime smoke tests using Python standard library
docs/       Architecture and development notes
.github/    CI workflows
```

## Security

The bridge is bound to **localhost only**. Do not expose it on the LAN
until authentication and device pairing are implemented. There are no
cockpit-control endpoints in this milestone.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap

1. Foundation: mock bridge, live React dashboard, CI.
2. Windows SimConnect compatibility probe and adapter.
3. Secured pairing and multi-device WebSocket transport.
4. PFD, moving map, autopilot/radio controls and aircraft profiles.
5. Windows tray, autostart, packaging and automatic updates.
