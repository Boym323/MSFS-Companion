export type MapPilot = {
  callsign: string;
  latitude: number;
  longitude: number;
  altitudeFeet: number;
  groundSpeedKt: number;
  heading: number;
  aircraft: string | null;
};

/** Quantize positions, preventing 20Hz telemetry from causing HTTP request churn. */
export function mapQueryCoordinate(value: number | null, max: number): number | null {
  return value !== null && Number.isFinite(value) && Math.abs(value) <= max
    ? Math.round(value * 10) / 10 : null;
}
export function mapQueryRadiusKm(zoom: number): number {
  return Number.isFinite(zoom)
    ? Math.max(30, Math.min(300, Math.round(100 * 2 ** (10 - zoom))))
    : 100;
}
export function validMapPilots(pilots: unknown): MapPilot[] {
  if (!Array.isArray(pilots)) return [];
  return pilots.slice(0, 80).filter((p): p is MapPilot =>
    p !== null && typeof p === 'object' &&
    typeof p.callsign === 'string' && p.callsign.length > 0 && p.callsign.length <= 24 &&
    typeof p.latitude === 'number' && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 85.05 &&
    typeof p.longitude === 'number' && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 &&
    typeof p.heading === 'number' && Number.isFinite(p.heading) &&
    p.heading >= 0 && p.heading <= 360 &&
    typeof p.altitudeFeet === 'number' && Number.isFinite(p.altitudeFeet) &&
    typeof p.groundSpeedKt === 'number' && Number.isFinite(p.groundSpeedKt));
}
