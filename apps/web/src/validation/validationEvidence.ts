// C31: pouze kontrolovaný souhrn diagnostiky, žádné surové odpovědi API.
type ObjectValue = Record<string, unknown>;
const obj = (value: unknown): ObjectValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as ObjectValue : {};
const bool = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;
const num = (value: unknown, min: number, max: number): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? Math.round(value * 100) / 100 : null;

export function buildValidationEvidence(
  rawStatus: unknown, rawSystems: unknown, rawNavigation: unknown, capturedAtUtc: string,
  rawA320?: unknown, rawWasm?: unknown,
) {
  const status = obj(rawStatus);
  const systems = obj(rawSystems);
  const nav = obj(rawNavigation);
  const mode = status.mode === 'simconnect' || status.mode === 'mock' ? status.mode : null;
  const online = mode === 'simconnect' && status.connected === true;
  const systemReady = online && systems.connected === true &&
    obj(systems.systems).mode === 'simconnect';
  const systemValues = systemReady ? obj(systems.systems) : {};
  const navValues = online && nav.connected === true ? obj(nav.navigation) : {};
  const airbus = obj(rawA320);
  const wasm = obj(rawWasm);
  // TITLE/profile identification is a candidate, never proof of actual V1 avionics.
  const candidate = online && airbus.connected === true &&
    airbus.profileId === 'a320-asobo-candidate';
  const aircraft = candidate && typeof airbus.aircraft === 'string' &&
    airbus.aircraft.length <= 150 && !/[\\u0000-\\u001f]/.test(airbus.aircraft)
      ? airbus.aircraft : null;
  const fcuAgeMs = candidate ? num(airbus.fcuAgeMs, 0, 5000) : null;
  const fcuFresh = aircraft !== null && fcuAgeMs !== null && airbus.fcu !== null &&
    typeof airbus.fcu === 'object' && !Array.isArray(airbus.fcu);
  const fcu = fcuFresh ? obj(airbus.fcu) : {};
  return {
    schema: 'kokpit-c31-evidence-v1',
    capturedAtUtc,
    note: 'Pouze technický snapshot. Není důkaz kompatibility ani potvrzení účinku ovladačů.',
    telemetry: {
      mode, live: online, connectionState:
        typeof status.connectionState === 'string' &&
        ['connected', 'connecting', 'disconnected'].includes(status.connectionState)
          ? status.connectionState : null,
      sampleAgeMs: num(status.sampleAgeMs, 0, 600000),
      sampleRateHz: num(status.sampleRateHz, 0, 300),
      incomingRateHz: num(status.incomingRateHz, 0, 300),
      publicationLagMs: num(status.publicationLagMs, 0, 600000),
      samplesReceived: num(status.samplesReceived, 0, Number.MAX_SAFE_INTEGER),
    },
    systems: {
      available: systemReady,
      sampleAgeMs: num(systems.sampleAgeMs, 0, 600000),
      onGround: bool(systemValues.onGround),
      altitudeAglFeet: num(systemValues.altitudeAglFeet, -5000, 100000),
      trueAirspeedKnots: num(systemValues.trueAirspeedKnots, 0, 2000),
      engineRpm: num(systemValues.engineRpm, 0, 100000),
      fuelGallons: num(systemValues.fuelGallons, 0, 200000),
    },
    a320: {
      candidate: aircraft !== null,
      aircraft,
      fcuReadbackFresh: fcuFresh,
      fcuAgeMs,
      selectedSpeedKnots: fcuFresh ? num(fcu.selectedSpeedKnots, 0, 450) : null,
      selectedHeadingDegrees: fcuFresh ? num(fcu.selectedHeadingDegrees, 0, 359.99) : null,
      selectedAltitudeFeet: fcuFresh ? num(fcu.selectedAltitudeFeet, -2000, 60000) : null,
      selectedVerticalSpeedFpm: fcuFresh ? num(fcu.selectedVerticalSpeedFpm, -10000, 10000) : null,
      wasmModuleReady: aircraft !== null && wasm.moduleReady === true,
      // A valid module ping is not a cockpit action confirmation.
      fmaVerified: false,
    },
    navigation: {
      available: online && nav.connected === true && nav.navigation != null,
      sampleAgeMs: num(nav.sampleAgeMs, 0, 600000),
      flightPlanActive: bool(navValues.flightPlanActive),
      waypointActive: bool(navValues.waypointActive),
      waypointCount: num(navValues.waypointCount, 0, 500),
      waypointIndex: num(navValues.waypointIndex, 0, 500),
      distanceNauticalMiles: num(navValues.distanceNauticalMiles, 0, 100000),
      crossTrackNauticalMiles: num(navValues.crossTrackNauticalMiles, -10000, 10000),
    },
  };
}

export type ValidationEvidence = ReturnType<typeof buildValidationEvidence>;
