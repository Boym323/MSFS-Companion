/** Read-only SimBrief flight context, scoped to this browser tab and 24 hours. */
export const FLIGHT_BRIEF_KEY = 'kokpit-simbrief-brief-v1';
export type FlightBrief = {
  origin: string; destination: string; alternate: string | null;
  aircraft: string; cruiseAltitudeFt: number | null;
  plannedFuel: number | null; fuelUnit: 'KG' | 'LB' | null;
  importedAt: string;
};
const icao = (s: unknown): s is string => typeof s === 'string' && /^[A-Z]{4}$/.test(s);
export function readFlightBrief(): FlightBrief | null {
  try {
    const raw = window.sessionStorage.getItem(FLIGHT_BRIEF_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const b = value as Partial<FlightBrief>;
    const age = Date.now() - Date.parse(b.importedAt ?? '');
    if (!icao(b.origin) || !icao(b.destination) ||
      (b.alternate != null && !icao(b.alternate)) ||
      typeof b.aircraft !== 'string' || b.aircraft.length > 24 ||
      !Number.isFinite(age) || age < 0 || age > 24 * 3600_000 ||
      (b.cruiseAltitudeFt != null && (!Number.isFinite(b.cruiseAltitudeFt) || b.cruiseAltitudeFt < 0 || b.cruiseAltitudeFt > 60000)) ||
      (b.plannedFuel != null && (!Number.isFinite(b.plannedFuel) || b.plannedFuel < 0 || b.plannedFuel > 1_000_000)) ||
      (b.fuelUnit !== null && b.fuelUnit !== 'KG' && b.fuelUnit !== 'LB')) return null;
    return b as FlightBrief;
  } catch { return null; }
}
export function safeSimBriefNumber(value: string, maximum: number): number | null {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) && n <= maximum ? n : null;
}
export function saveFlightBrief(data: Omit<FlightBrief, 'importedAt'>): void {
  try { window.sessionStorage.setItem(FLIGHT_BRIEF_KEY,
    JSON.stringify({ ...data, importedAt: new Date().toISOString() })); }
  catch { /* browser may deny session storage */ }
}
