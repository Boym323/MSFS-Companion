import type { TelemetrySnapshot } from '../telemetry/types';

export type FlightPerformance = {
  airborneSeconds: number | null;
  averageAirborneIasKt: number | null;
  peakAbsoluteBankDegrees: number | null;
  maxAglFeet: number | null;
  recordedDistanceKm: number;
  validTrackSegments: number;
};

function segmentKm(a: TelemetrySnapshot, b: TelemetrySnapshot): number | null {
  if (![a.latitude,a.longitude,b.latitude,b.longitude].every(Number.isFinite)
    || Math.abs(a.latitude) > 90 || Math.abs(b.latitude) > 90
    || Math.abs(a.longitude) > 180 || Math.abs(b.longitude) > 180) return null;
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLon = ((((b.longitude-a.longitude)+540)%360)-180) * r;
  const h = Math.sin(dLat/2)**2 + Math.cos(a.latitude*r)*Math.cos(b.latitude*r)
    * Math.sin(dLon/2)**2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}

export function analyzePerformance(samples: TelemetrySnapshot[]): FlightPerformance {
  let airborneSeconds = 0;
  let knownGround = false, speedWeighted = 0, speedSeconds = 0;
  let distanceKm = 0, validTrackSegments = 0;
  let peakBank: number | null = null, maxAgl: number | null = null;
  for (let i=0;i<samples.length;i++) {
    const p = samples[i];
    if (Number.isFinite(p.bankDegrees))
      peakBank = Math.max(peakBank ?? 0, Math.abs(p.bankDegrees));
    if (p.altitudeAglFeet !== undefined && p.altitudeAglFeet !== null &&
      Number.isFinite(p.altitudeAglFeet) && p.altitudeAglFeet >= 0)
      maxAgl = Math.max(maxAgl ?? 0,p.altitudeAglFeet);
    if (typeof p.onGround === 'boolean') knownGround = true;
    if (i===0) continue;
    const a=samples[i-1];
    const seconds = (Date.parse(p.timestampUtc)-Date.parse(a.timestampUtc))/1000;
    // Explicitně nepřeklenovat dlouhé mezery nebo přeskok času v replay.
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 30) continue;
    const km = segmentKm(a,p);
    // Teleportace nebo restart letadla nejsou proletěná vzdálenost.
    if (km !== null && km <= Math.max(5,seconds*0.20)) {
      distanceKm += km; validTrackSegments++;
    }
    if (a.onGround === false && p.onGround === false) {
      airborneSeconds += seconds;
      if (Number.isFinite(a.airspeedKnots) && a.airspeedKnots >= 0) {
        speedWeighted += a.airspeedKnots*seconds;
        speedSeconds += seconds;
      }
    }
  }
  return {
    airborneSeconds: knownGround ? airborneSeconds : null,
    averageAirborneIasKt: speedSeconds ? speedWeighted/speedSeconds : null,
    peakAbsoluteBankDegrees: peakBank, maxAglFeet: maxAgl,
    recordedDistanceKm: distanceKm, validTrackSegments,
  };
}

const columns = ['timestampUtc','latitude','longitude','airspeedKnots',
  'altitudeFeet','verticalSpeedFeetPerMinute','headingDegrees','pitchDegrees',
  'bankDegrees','altitudeAglFeet','onGround','touchdownRateFpm','gForce'] as const;
function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  const text = String(value);
  // CSV injection protection, even when sources are not directly user-editable.
  const safe = /^[=+@\-\t\r]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g,'""') + '"';
}

export function exportFlightCsv(samples: TelemetrySnapshot[]): string {
  return [columns.join(','),...samples.map(point =>
    columns.map(key => csvValue(point[key])).join(','))].join('\r\n')+'\r\n';
}
