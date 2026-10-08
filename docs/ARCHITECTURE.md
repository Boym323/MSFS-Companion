# Architecture — Foundation V1

MSFS Companion is a local cockpit companion for Microsoft Flight Simulator 2020.

## Data path

```
MockTelemetrySource  -- TelemetryStore -- GET /api/telemetry
                                          GET /api/status
                                          WS /ws
                                              |
                                         React dashboard
```

The application currently supports **mock data only**. The future Windows-specific
SimConnect source will implement `ITelemetrySource` and update the same store.
The web frontend intentionally does not depend on the source of telemetry.

## API (v0.1)

- `GET /api/status` — source mode and bridge status.
- `GET /api/telemetry` — latest immutable snapshot.
- `WS /ws` — read-only JSON telemetry at approximately 20 messages/second.

The WebSocket payload uses camelCase JSON property names. Geographic coordinates
are decimal degrees, altitudes feet, airspeed knots, heading/pitch/bank degrees,
vertical speed feet/minute, and timestamps UTC ISO 8601.

## Security boundary

The backend listens on **127.0.0.1:8765** by default. This milestone has no
remote pairing, authentication, or command endpoint. Do not expose it to a public
network or change the bind address for remote access until a pairing/authentication
scheme and command allow-list are implemented.

## Planned future adapters

- `SimConnectTelemetrySource` (Windows/MSFS 2020, SDK compatibility probe first).
- Aircraft-specific input-event profiles.
- Validated, authenticated commands for autopilot and radio operation.
- Tray application, auto-start and signed update launcher.

No AGPL source code from MSFS Mobile Companion App or MSFS Glass is included.
