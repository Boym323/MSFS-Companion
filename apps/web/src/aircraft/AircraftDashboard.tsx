import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import './AircraftDashboard.css';

type Systems = {
  timestampUtc: string;
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
type SystemsStatus = {
  connected: boolean;
  sampleAgeMs: number | null;
  lastUpdatedUtc: string | null;
  systems: Systems | null;
};

function Metric({ name, value, unit }: { name: string; value: string | number; unit?: string }) {
  return (
    <div className="aircraft-measure">
      <dt>{name}</dt>
      <dd>{value}{unit && value !== '—' ? <small> {unit}</small> : null}</dd>
    </div>
  );
}

function aircraftProfile(aircraft: string) {
  if (/xcub/i.test(aircraft)) return 'XCub · univerzální profil (včetně plováků)';
  if (/cessna|c172/i.test(aircraft)) return 'Cessna · univerzální profil';
  if (/a320|airbus/i.test(aircraft)) return 'Airbus · univerzální profil';
  return 'Univerzální profil MSFS';
}

export default function AircraftDashboard({
  telemetry,
}: { telemetry: TelemetrySnapshot | null }) {
  const [state, setState] = useState<SystemsStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let running = false;
    const refresh = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch('/api/aircraft/systems', { cache: 'no-store' });
        if (!response.ok) throw new Error('Systémové API není dostupné.');
        const data = await response.json() as SystemsStatus;
        if (!cancelled) {
          setState(data);
          setError('');
        }
      } catch {
        if (!cancelled) {
          setState(null);
          setError('Rozšířená systémová telemetrie není dostupná.');
        }
      } finally { running = false; }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const systems = telemetry && state?.connected ? state.systems : null;
  const aircraft = telemetry?.aircraft ?? 'Čekám na letadlo';
  const fmt = (value: number | undefined, digits = 0) =>
    value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
  const yesNo = (value: boolean | undefined) =>
    value === undefined ? '—' : value ? 'ANO' : 'NE';

  return (
    <section className="aircraft-dashboard" aria-label="Informace o letadle">
      <div className="aircraft-dashboard-head">
        <div>
          <span className="eyebrow">B7 · AIRCRAFT DASHBOARD</span>
          <h2>{aircraft}</h2>
          <p>{aircraftProfile(aircraft)}</p>
        </div>
        <span className="aircraft-dashboard-signal">
          {systems
            ? `Systémová data ${systems.mode === 'mock' ? '· TEST' : '· LIVE'} · 1 Hz`
            : 'Systémová data nedostupná'}
        </span>
      </div>

      {!telemetry && (
        <p className="telemetry-offline" role="status">
          MSFS není připojený, poslední údaje nejsou platné.
        </p>
      )}
      {error && <p className="aircraft-dashboard-info" role="status">{error}</p>}
      {telemetry && !systems && !error && (
        <p className="aircraft-dashboard-info">
          Rychlá letová data fungují, ale pomalé systémové údaje se teprve načítají
          nebo je toto letadlo neposkytuje.
        </p>
      )}

      <div className="aircraft-dashboard-grid">
        <article>
          <h3>Letové údaje</h3>
          <dl>
            <Metric name="Indikovaná rychlost IAS" value={fmt(telemetry?.airspeedKnots, 0)} unit="KT" />
            <Metric name="Skutečná rychlost TAS" value={fmt(systems?.trueAirspeedKnots)} unit="KT" />
            <Metric name="Rychlost vůči zemi GS" value={fmt(systems?.groundSpeedKnots)} unit="KT" />
            <Metric name="Indikovaná výška" value={fmt(telemetry?.altitudeFeet)} unit="FT" />
            <Metric name="Výška nad terénem AGL" value={fmt(systems?.altitudeAglFeet)} unit="FT" />
            <Metric name="Vertikální rychlost" value={fmt(telemetry?.verticalSpeedFeetPerMinute)} unit="FT/MIN" />
          </dl>
        </article>
        <article>
          <h3>Autopilot · pouze sledování</h3>
          <dl>
            <Metric name="Hlavní vypínač AP" value={yesNo(systems?.autopilotMaster)} />
            <Metric name="Zvolený kurz" value={fmt(systems?.autopilotSelectedHeadingDegrees)} unit="°" />
            <Metric name="Zvolená výška" value={fmt(systems?.autopilotSelectedAltitudeFeet)} unit="FT" />
            <Metric name="Zvolená vertikální rychlost" value={fmt(systems?.autopilotSelectedVerticalSpeedFpm)} unit="FT/MIN" />
            <Metric name="Skutečný magnetický kurz" value={fmt(telemetry?.headingDegrees)} unit="°" />
          </dl>
        </article>
        <article>
          <h3>Konfigurace a motor</h3>
          <dl>
            <Metric name="Na zemi" value={yesNo(systems?.onGround)} />
            <Metric name="Poloha klapek" value={fmt(systems?.flapsPercent)} unit="%" />
            <Metric name="Podvozek dole" value={yesNo(systems?.gearDown)} />
            <Metric name="Otáčky motoru č. 1" value={fmt(systems?.engineRpm)} unit="RPM" />
            <Metric name="Celkové palivo" value={fmt(systems?.fuelGallons, 1)} unit="US GAL" />
          </dl>
        </article>
        <article>
          <h3>Počasí a poloha</h3>
          <dl>
            <Metric name="Směr větru" value={fmt(systems?.windDirectionDegrees)} unit="°" />
            <Metric name="Rychlost větru" value={fmt(systems?.windSpeedKnots)} unit="KT" />
            <Metric name="Zeměpisná šířka" value={fmt(telemetry?.latitude, 5)} unit="°" />
            <Metric name="Zeměpisná délka" value={fmt(telemetry?.longitude, 5)} unit="°" />
            <Metric name="Stáří systémového vzorku" value={fmt(systems ? state?.sampleAgeMs ?? undefined : undefined)} unit="ms" />
          </dl>
        </article>
      </div>
      <p className="aircraft-dashboard-note">
        Pouze čtení. U plovákových a specializovaných letadel mohou některé univerzální SimVars
        vracet nulu nebo být nedostupné. Ovládání autopilota, klapek ani podvozku zde není povoleno.
      </p>
    </section>
  );
}
