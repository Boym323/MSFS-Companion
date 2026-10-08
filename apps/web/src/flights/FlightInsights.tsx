import type { TelemetrySnapshot } from '../telemetry/types';
import { analyzeFlight, phaseNames, type FlightPhase } from './analysis';
import './FlightInsights.css';

const order: FlightPhase[] = ['ground', 'climb', 'level', 'descent', 'approach'];
const duration = (seconds: number) => seconds > 0 ? `${Math.round(seconds / 60)} min` : '—';

export default function FlightInsights({ samples, mode }: { samples: TelemetrySnapshot[]; mode: 'mock' | 'simconnect' }) {
  const result = analyzeFlight(samples);
  return (
    <section className="flight-insights" aria-label="Letová analýza">
      <div className="flight-insights-heading">
        <div><span className="eyebrow">B10 · FLIGHT INTELLIGENCE</span><h3>Analýza průběhu letu</h3></div>
        <span>{mode === 'mock' ? 'TESTOVACÍ DATA' : 'ODHAD ZE SIMCONNECTU'}</span>
      </div>
      <div className="flight-insights-grid">
        {order.map((phase) => (
          <div key={phase}><small>{phaseNames[phase]}</small><strong>{duration(result.seconds[phase])}</strong></div>
        ))}
        <div><small>Nejvyšší stoupání</small><strong>{Math.round(result.climbPeakFpm)} FT/MIN</strong></div>
        <div><small>Nejvyšší klesání</small><strong>{Math.round(result.descentPeakFpm)} FT/MIN</strong></div>
      </div>
      <h4>Rozpoznané události</h4>
      {result.events.length === 0
        ? <p>V tomto záznamu není dost podkladů pro spolehlivé rozpoznání událostí.</p>
        : <ol>{result.events.map((event, i) => (
          <li key={`${event.at}-${event.kind}-${i}`}>
            <time dateTime={event.at}>{new Date(event.at).toLocaleTimeString('cs-CZ')}</time>
            <span>{event.label}</span>
          </li>
        ))}</ol>}
      <p className="flight-insights-note">
        Pozemní fáze a kontakt se zemí lze určit pouze tam, kde nové záznamy obsahují
        čerstvou SimVar „SIM ON GROUND“. Starší lety bez tohoto údaje nemohou vykazovat
        potvrzené vzlety či přistání. Přiblížení je jen orientační odhad z AGL, IAS a VS.
        Při převzorkování dlouhého letu jsou časy přibližné.
      </p>
    </section>
  );
}
