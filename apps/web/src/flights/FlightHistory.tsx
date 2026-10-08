import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import FlightInsights from './FlightInsights';
import FlightRouteMap from './FlightRouteMap';
import { exportFlightCsv } from './performance';
import './FlightHistory.css';

type FlightSummary = {
  id: string;
  mode: 'mock' | 'simconnect';
  aircraft: string;
  startedAtUtc: string;
  endedAtUtc: string | null;
  lastAtUtc: string;
  samples: number;
  distanceMeters: number;
  maxAirspeedKnots: number;
  maxAltitudeFeet: number;
  active: boolean;
};
type FlightDetail = { summary: FlightSummary; samples: TelemetrySnapshot[] };

function timestamp(value: string) {
  return new Date(value).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'medium' });
}
function elapsed(summary: FlightSummary) {
  const seconds = Math.max(0, Math.round((Date.parse(summary.lastAtUtc) - Date.parse(summary.startedAtUtc)) / 1000));
  return `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
}

function chart(samples: TelemetrySnapshot[], key: 'altitudeFeet' | 'airspeedKnots', height = 92) {
  if (samples.length < 2) return '';
  const values = samples.map((s) => s[key]);
  const min = Math.min(...values), max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return values.map((v, index) => {
    const x = 12 + index * 596 / (values.length - 1);
    const y = 8 + (1 - (v - min) / range) * height;
    return `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export default function FlightHistory() {
  const [flights, setFlights] = useState<FlightSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<FlightDetail | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/flights', { cache: 'no-store' });
        if (!response.ok) throw new Error('Historii nelze načíst z Windows bridge.');
        const list = (await response.json()) as FlightSummary[];
        if (cancelled) return;
        setFlights(list);
        setSelected((old) => old || list[0]?.id || '');
        setError('');
      } catch {
        if (!cancelled) setError('Záznamy letu nejsou dostupné. Zkontrolujte Windows bridge.');
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/flights/${encodeURIComponent(selected)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Záznam letu nebyl nalezen.');
        const data = (await response.json()) as FlightDetail;
        if (!cancelled) setDetail(data);
      } catch {
        if (!cancelled) setDetail(null);
      }
    };
    void load();
    const timer = window.setInterval(() => { void load(); }, 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [selected]);

  const samples = detail?.samples ?? [];
  const index = Math.min(cursor, Math.max(0, samples.length - 1));
  const point = samples[index];

  useEffect(() => {
    if (!playing || samples.length < 2) return;
    const timer = window.setInterval(() => setCursor((index) => Math.min(index + 1, samples.length - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [playing, samples.length]);
  useEffect(() => {
    if (playing && cursor >= samples.length - 1) setPlaying(false);
  }, [cursor, playing, samples.length]);

  return (
    <section className="flight-history" aria-label="Historie zaznamenaných letů">
      <div className="flight-history-heading">
        <span className="eyebrow">B5 · FLIGHT RECORDER</span>
        <h2>Historie letů a přehrávání</h2>
        <p>Bridge ukládá body letu na Windows PC automaticky, i když není otevřený web.</p>
      </div>
      {error && <p className="telemetry-offline" role="status">{error}</p>}
      <div className="flight-history-layout">
        <aside className="flight-history-list" aria-label="Zaznamenané lety">
          {flights.length === 0 && <p>Zatím nebyl zaznamenán žádný let.</p>}
          {flights.map((flight) => (
            <button key={flight.id} type="button" className={flight.id === selected ? 'selected' : ''}
              onClick={() => { setSelected(flight.id); setDetail(null); setCursor(0); setPlaying(false); }}>
              <strong>{flight.aircraft}</strong>
              <span>{timestamp(flight.startedAtUtc)}</span>
              <small>{flight.active ? '● Právě se zaznamenává' : elapsed(flight)}
                {flight.mode === 'mock' ? ' · TESTOVACÍ DATA' : ''}</small>
            </button>
          ))}
        </aside>
        <div className="flight-history-main">
          {!detail ? (
            <p className="flight-history-empty">Vyberte let v historii. Záznamy vznikají přibližně jednou za sekundu.</p>
          ) : (
            <>
              <div className="flight-history-summary">
                <div><span>Letadlo</span><strong>{detail.summary.aircraft}</strong></div>
                <div><span>Délka letu</span><strong>{elapsed(detail.summary)}</strong></div>
                <div><span>Vzdálenost</span><strong>{(detail.summary.distanceMeters / 1000).toFixed(1)} km</strong></div>
                <div><span>Vzorky</span><strong>{detail.summary.samples}</strong></div>
                <div><span>Max. IAS</span><strong>{Math.round(detail.summary.maxAirspeedKnots)} KT</strong></div>
                <div><span>Max. výška</span><strong>{Math.round(detail.summary.maxAltitudeFeet)} FT</strong></div>
              </div>

              <div className="flight-history-export">
                <button type="button" disabled={!samples.length} onClick={() => {
                  const csv = exportFlightCsv(samples);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'msfs-let-' + detail.summary.id.replace(/[^a-zA-Z0-9_-]/g,'_') + '.csv';
                  document.body.append(link);
                  link.click();
                  link.remove();
                  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                }}>Exportovat záznam do CSV</button>
                <span>Soubor zůstává v prohlížeči. Nedochází k odeslání do externí služby.</span>
              </div>
              <FlightInsights samples={samples} mode={detail.summary.mode} />
              <h3>Průběh výšky a rychlosti</h3>
              <svg className="flight-history-chart" viewBox="0 0 620 224" role="img"
                aria-label="Graf vývoje výšky a indikované rychlosti během letu">
                <line x1="12" y1="106" x2="608" y2="106" stroke="#5b7490" />
                <path d={chart(samples, 'altitudeFeet')} stroke="#83cff6" strokeWidth="2.7" fill="none" />
                <g transform="translate(0 110)">
                  <path d={chart(samples, 'airspeedKnots')} stroke="#efd184" strokeWidth="2.7" fill="none" />
                </g>
                <text x="16" y="14" fill="#83cff6" fontSize="13">VÝŠKA · FT</text>
                <text x="16" y="124" fill="#efd184" fontSize="13">RYCHLOST · KT</text>
              </svg>

              <h3>Schéma proletěné trasy</h3>
              <FlightRouteMap samples={samples} selectedIndex={index} />

              <div className="flight-history-player">
                <button type="button" disabled={samples.length < 2} onClick={() => {
                  if (!playing && cursor >= samples.length - 1) setCursor(0);
                  setPlaying((v) => !v);
                }}>{playing ? 'Pozastavit' : '▶ Přehrát let'}</button>
                <input type="range" min="0" max={Math.max(samples.length - 1, 0)}
                  value={index} onChange={(event) => { setCursor(Number(event.target.value)); setPlaying(false); }}
                  aria-label="Poloha v záznamu letu" />
                <span>{point ? timestamp(point.timestampUtc) : 'Žádná data'}</span>
              </div>

              <div className="flight-history-values">
                <span>IAS <strong>{point ? point.airspeedKnots.toFixed(0) : '—'} KT</strong></span>
                <span>ALT <strong>{point ? point.altitudeFeet.toFixed(0) : '—'} FT</strong></span>
                <span>HDG <strong>{point ? point.headingDegrees.toFixed(0) : '—'}°</strong></span>
                <span>GPS <strong>{point ? `${point.latitude.toFixed(4)}°, ${point.longitude.toFixed(4)}°` : '—'}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>
      <p className="flight-history-note">
        Historie je dostupná každému zařízení ve stejné důvěryhodné domácí podsíti.
        Záznamy se uchovávají na Windows PC (max. 30 letů / 100 MB) a obsahují polohu.
        Pro dlouhý let mohou být body při přehrávání převzorkované.
      </p>
    </section>
  );
}
