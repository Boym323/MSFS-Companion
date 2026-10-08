import type { TelemetrySnapshot } from '../telemetry/types';

export type FlightPhase = 'ground' | 'approach' | 'climb' | 'descent' | 'level';
export type FlightEvent = { kind: 'takeoff' | 'touchdown' | 'climb' | 'descent' | 'approach';
  at: string; label: string; touchdownRateFpm?: number | null; gForce?: number | null };
export type FlightAnalysis = {
  seconds: Record<FlightPhase, number>;
  climbPeakFpm: number;
  descentPeakFpm: number;
  events: FlightEvent[];
  reliableGroundSamples: number;
  totalSamples: number;
};

const phaseNames: Record<FlightPhase, string> = {
  ground: 'Na zemi (SimVar)',
  approach: 'Přiblížení (odhad)',
  climb: 'Stoupání',
  descent: 'Klesání',
  level: 'Ustálený let',
};
export { phaseNames };

export function classifyPhase(point: TelemetrySnapshot): FlightPhase {
  // U starého záznamu bez onGround se vyhýbáme falešnému rozpoznání země.
  if (point.onGround === true) return 'ground';
  const vs = point.verticalSpeedFeetPerMinute;
  if (point.onGround === false && point.altitudeAglFeet != null
      && Number.isFinite(point.altitudeAglFeet) && point.altitudeAglFeet >= 0
      && point.altitudeAglFeet < 1500 && point.airspeedKnots > 45 && vs < -200) return 'approach';
  if (vs > 300) return 'climb';
  if (vs < -300) return 'descent';
  return 'level';
}

/** Odhad fází z 1Hz záznamu (u dlouhých letů mohou být body převzorkované). */
export function analyzeFlight(samples: TelemetrySnapshot[]): FlightAnalysis {
  const seconds: Record<FlightPhase, number> = { ground: 0, approach: 0, climb: 0, descent: 0, level: 0 };
  const events: FlightEvent[] = [];
  let climbPeakFpm = 0, descentPeakFpm = 0;
  let reliableGroundSamples = 0;
  for (let i = 0; i < samples.length; i++) {
    const p = samples[i];
    if (typeof p.onGround === 'boolean') reliableGroundSamples++;
    if (Number.isFinite(p.verticalSpeedFeetPerMinute)) {
      climbPeakFpm = Math.max(climbPeakFpm, p.verticalSpeedFeetPerMinute);
      descentPeakFpm = Math.min(descentPeakFpm, p.verticalSpeedFeetPerMinute);
    }
    if (i + 1 >= samples.length) continue;
    const dt = (Date.parse(samples[i + 1].timestampUtc) - Date.parse(p.timestampUtc)) / 1000;
    if (dt <= 0 || dt > 30 || !Number.isFinite(dt)) continue;
    seconds[classifyPhase(p)] += dt;
  }
  // Pro přechod na zemi/v letu vyžadujeme dva platné vzorky
  // před přechodem a dva po něm, aby nevznikala falešná přistání.
  for (let i = 2; i + 1 < samples.length; i++) {
    const a = samples[i - 2], b = samples[i - 1], c = samples[i], d = samples[i + 1];
    if (a.onGround == null || b.onGround == null || c.onGround == null || d.onGround == null) continue;
    const gap = (Date.parse(d.timestampUtc) - Date.parse(a.timestampUtc)) / 1000;
    if (gap <= 0 || gap > 30) continue;
    if (a.onGround && b.onGround && !c.onGround && !d.onGround) {
      events.push({ kind: 'takeoff', at: c.timestampUtc, label: 'Opuštění země · podle SimVar' });
    } else if (!a.onGround && !b.onGround && c.onGround && d.onGround) {
      const velocity = [c.touchdownRateFpm, d.touchdownRateFpm]
        .find(value => value !== null && value !== undefined && Number.isFinite(value));
      const g = [c.gForce, d.gForce].find(value =>
        value !== null && value !== undefined && Number.isFinite(value));
      events.push({ kind: 'touchdown', at: c.timestampUtc,
        label: 'Kontakt se zemí · podle SimVar',
        touchdownRateFpm: velocity ?? null, gForce: g ?? null });
    }
  }
  // Významné letové úseky: aspoň 15 s souvislého stoupání, klesání či přiblížení.
  let start = 0;
  for (let i = 1; i <= samples.length; i++) {
    const changed = i === samples.length || classifyPhase(samples[i]) !== classifyPhase(samples[start])
      || (Date.parse(samples[i].timestampUtc) - Date.parse(samples[i - 1].timestampUtc)) / 1000 > 30;
    if (!changed) continue;
    if (i - start >= 2) {
      const duration = (Date.parse(samples[i - 1].timestampUtc) - Date.parse(samples[start].timestampUtc)) / 1000;
      const phase = classifyPhase(samples[start]);
      if (duration >= 15 && (phase === 'climb' || phase === 'descent' || phase === 'approach')) {
        events.push({ kind: phase, at: samples[start].timestampUtc,
          label: phase === 'approach' ? 'Pravděpodobné přiblížení' : phase === 'climb' ? 'Úsek stoupání' : 'Úsek klesání' });
      }
    }
    start = i;
  }
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { seconds, climbPeakFpm, descentPeakFpm, events: events.slice(0, 30), reliableGroundSamples, totalSamples: samples.length };
}
