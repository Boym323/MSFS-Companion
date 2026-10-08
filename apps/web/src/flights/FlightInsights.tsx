import type { TelemetrySnapshot } from '../telemetry/types';
import { analyzeFlight, phaseNames, type FlightPhase } from './analysis';
import './FlightInsights.css';
import { analyzePerformance } from './performance';

const order: FlightPhase[] = ['ground', 'climb', 'level', 'descent', 'approach'];
const duration = (seconds: number) => seconds > 0 ? `${Math.round(seconds / 60)} min` : '—';

export default function FlightInsights({ samples, mode }: { samples: TelemetrySnapshot[]; mode: 'mock' | 'simconnect' }) {
  const result = analyzeFlight(samples);
  const landings = result.events.filter(event => event.kind === 'touchdown');
  const metrics = analyzePerformance(samples);
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
      <h4>C18 · Pokročilá analýza záznamu</h4>
      <div className="flight-insights-grid">
        <div><small>Prokazatelný čas ve vzduchu</small><strong>
          {metrics.airborneSeconds == null ? '—' : Math.round(metrics.airborneSeconds / 60) + ' min'}
        </strong></div>
        <div><small>Průměrná IAS za letu</small><strong>
          {metrics.averageAirborneIasKt == null ? '—' : Math.round(metrics.averageAirborneIasKt) + ' KT'}
        </strong></div>
        <div><small>Nejvyšší absolutní náklon</small><strong>
          {metrics.peakAbsoluteBankDegrees == null ? '—' : Math.round(metrics.peakAbsoluteBankDegrees) + '°'}
        </strong></div>
        <div><small>Nejvyšší zaznamenaná AGL</small><strong>
          {metrics.maxAglFeet == null ? '—' : Math.round(metrics.maxAglFeet) + ' ft'}
        </strong></div>
      </div>
      <p>Proletěná GPS vzdálenost podle souvislých vzorků:
        {' '}{metrics.recordedDistanceKm.toFixed(1)} km
        {' '}({metrics.validTrackSegments} ověřených úseků).
        Teleportace a mezery delší než 30 s jsou vynechány.</p>
      <h4>C10 · Přistávací analytika</h4>
      {landings.length === 0
        ? <p>Nemáme potvrzený kontakt se zemí. U starších letů mohou chybět
          rozšířené touchdown SimVars.</p>
        : <div className="flight-insights-grid">{landings.map((landing, index) =>
          <div key={landing.at + index}>
            <small>Dosednutí {index + 1} · {new Date(landing.at).toLocaleTimeString('cs-CZ')}</small>
            <strong>{landing.touchdownRateFpm == null
              ? '— ft/min'
              : Math.round(landing.touchdownRateFpm) + ' ft/min'}</strong>
            <small>G poblíž dosednutí: {landing.gForce == null ? '—' : landing.gForce.toFixed(2)}
              {' '}· vzorková hodnota, nikoli peak G</small>
          </div>)}</div>}
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
        Při převzorkování dlouhého letu jsou časy přibližné. C10 používá poslední známou normálovou rychlost dosednutí ze SimConnectu; záznam po 1 s nemusí zachytit odskok ani špičkové přetížení.
      </p>
    </section>
  );
}
