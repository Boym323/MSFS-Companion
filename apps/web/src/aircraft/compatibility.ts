/** Diagnostika pozorovaných SimVars, nikoli certifikace avioniky. */
export type SystemsValues = {
  mode: 'mock' | 'simconnect';
  trueAirspeedKnots: number;
  groundSpeedKnots: number;
  altitudeAglFeet: number;
  windDirectionDegrees: number;
  windSpeedKnots: number;
  onGround: boolean;
  flapsPercent: number;
  gearDown: boolean;
  autopilotMaster: boolean;
  autopilotSelectedHeadingDegrees: number;
  autopilotSelectedAltitudeFeet: number;
  autopilotSelectedVerticalSpeedFpm: number;
  engineRpm: number;
  fuelGallons: number;
};

type NumericKey = Exclude<keyof SystemsValues, 'mode' | 'onGround' | 'gearDown' | 'autopilotMaster'>;
export type CompatibilityCheck = { label: string; state: 'received' | 'suspect' | 'unavailable'; detail: string };

const groups: ReadonlyArray<{ label: string; fields: ReadonlyArray<{ key: NumericKey; min: number; max: number }> }> = [
  { label: 'Rychlosti (TAS / GS)', fields: [
    { key: 'trueAirspeedKnots', min: 0, max: 900 }, { key: 'groundSpeedKnots', min: 0, max: 1300 }] },
  { label: 'Výška AGL', fields: [{ key: 'altitudeAglFeet', min: -2000, max: 100000 }] },
  { label: 'Vítr', fields: [
    { key: 'windDirectionDegrees', min: 0, max: 360 }, { key: 'windSpeedKnots', min: 0, max: 250 }] },
  { label: 'Klapky', fields: [{ key: 'flapsPercent', min: 0, max: 100 }] },
  { label: 'Autopilot', fields: [
    { key: 'autopilotSelectedHeadingDegrees', min: 0, max: 360 },
    { key: 'autopilotSelectedAltitudeFeet', min: -2000, max: 100000 },
    { key: 'autopilotSelectedVerticalSpeedFpm', min: -15000, max: 15000 }] },
  { label: 'Motor / palivo', fields: [
    { key: 'engineRpm', min: 0, max: 20000 }, { key: 'fuelGallons', min: 0, max: 50000 }] },
];

export function profileLabel(title: string): string {
  if (/xcub/i.test(title)) return 'XCub / XCub Floats';
  if (/cessna|c172/i.test(title)) return 'Cessna (ověřit přesnou variantu)';
  if (/airbus|a320/i.test(title)) return 'Airbus (obecné SimVars)';
  return 'Ostatní letadla (obecné SimVars)';
}

/** Nulová hodnota může být legitimní i nepodporovaná; nelze z ní odvodit kompatibilitu. */
export function compatibilityChecks(systems: SystemsValues | null): CompatibilityCheck[] {
  return groups.map(({ label, fields }) => {
    if (!systems) return { label, state: 'unavailable', detail: 'Bez čerstvého vzorku' };
    const invalid = fields.filter(({ key, min, max }) => {
      const value = systems[key];
      return typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max;
    });
    return invalid.length
      ? { label, state: 'suspect', detail: 'Neplatná nebo neobvyklá hodnota' }
      : { label, state: 'received', detail: systems.mode === 'mock' ? 'TESTOVACÍ vzorek' : 'Přijato · ověřit v kokpitu' };
  });
}

/** Diagnostický export úmyslně neobsahuje polohu ani trasu letu. */
export function compatibilityReport(aircraft: string, systems: SystemsValues | null, sampleAgeMs: number | null) {
  return {
    schema: 'msfs-aircraft-compatibility-b8-v1',
    aircraft,
    source: systems?.mode ?? 'unavailable',
    sampleAgeMs: systems ? sampleAgeMs : null,
    verification: 'NOT_VERIFIED_IN_SIMULATOR',
    checks: compatibilityChecks(systems),
    systems,
  };
}
