import type { TelemetrySnapshot } from '../telemetry/types';

export type PilotPhase = 'unknown' | 'ground' | 'climb' | 'cruise' | 'descent' | 'approach';
export const phaseTitles: Record<PilotPhase, string> = {
  unknown: 'Neověřená fáze', ground: 'Na zemi', climb: 'Stoupání',
  cruise: 'Let', descent: 'Klesání', approach: 'Přiblížení'
};
export function pilotPhase(s: TelemetrySnapshot | null): PilotPhase {
  if (!s) return 'unknown';
  if (s.onGround === true) return 'ground';
  if (s.onGround !== false) return 'unknown';
  if (s.altitudeAglFeet != null && Number.isFinite(s.altitudeAglFeet)
    && s.altitudeAglFeet >= 0 && s.altitudeAglFeet < 1500
    && s.airspeedKnots > 45 && s.verticalSpeedFeetPerMinute < -200) return 'approach';
  if (s.verticalSpeedFeetPerMinute > 350) return 'climb';
  if (s.verticalSpeedFeetPerMinute < -350) return 'descent';
  return 'cruise';
}
export function pilotHints(phase: PilotPhase): string[] {
  switch (phase) {
    case 'ground': return ['Ověř plán letu a dostupné frekvence.', 'Proveď ruční checklist podle aktuálního letadla.'];
    case 'climb': return ['Porovnej plánovanou a skutečnou trasu.', 'Sleduj dostupné údaje o stoupání a palivu.'];
    case 'cruise': return ['Zkontroluj aktivní GPS bod a odhad vytrvalosti.', 'Před sestupem otevři briefing cílového letiště.'];
    case 'descent': return ['Otevři briefing letiště a ověř dostupné počasí.', 'Připrav ruční checklist pro přiblížení.'];
    case 'approach': return ['Ověř dráhu, frekvence a údaje z avioniky.', 'Proveď checklist pro přiblížení a přistání.'];
    default: return ['Čekám na potvrzený stav letadla ze SimConnectu.'];
  }
}