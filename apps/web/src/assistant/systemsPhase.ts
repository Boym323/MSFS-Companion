export type PhaseEvidence = {
  aircraft: string;
  observedAtMs: number;
  onGround: boolean;
  altitudeAglFeet: number | null;
};

/** Výhradně čerstvý 1Hz live readback. Neplatná data znamenají neznámou fázi. */
export function readPhaseEvidence(payload: unknown, aircraft: string, nowMs: number): PhaseEvidence | null {
  if (!payload || typeof payload !== 'object' || !aircraft || !Number.isFinite(nowMs))
    return null;
  const data = payload as Record<string, unknown>;
  if (data.connected !== true || !data.systems || typeof data.systems !== 'object')
    return null;
  const systems = data.systems as Record<string, unknown>;
  if (systems.mode !== 'simconnect' || typeof systems.onGround !== 'boolean') return null;
  const timestamp = typeof systems.timestampUtc === 'string' ? Date.parse(systems.timestampUtc) : NaN;
  const reportedAge = data.sampleAgeMs;
  if (!Number.isFinite(timestamp) || timestamp > nowMs + 2000 || nowMs - timestamp > 5000 ||
    typeof reportedAge !== 'number' || !Number.isFinite(reportedAge) ||
    reportedAge < 0 || reportedAge > 5000) return null;
  const agl = systems.altitudeAglFeet;
  const altitudeAglFeet = typeof agl === 'number' && Number.isFinite(agl) &&
    agl >= 0 && agl <= 60000 ? agl : null;
  return {aircraft, observedAtMs: nowMs, onGround: systems.onGround, altitudeAglFeet};
}
