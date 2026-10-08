import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';

type Pilot = {
  callsign: string; latitude: number; longitude: number;
  altitudeFeet: number; groundSpeedKt: number; heading: number;
  aircraft: string | null;
};
type Controller = { callsign: string; frequency: string; facility: number };
type Data = { available: boolean; source: string; updatedAt: string | null;
  stale: boolean; error: string | null; pilots: Pilot[]; controllers: Controller[] };

export default function VatsimCenter({ telemetry }: { telemetry: TelemetrySnapshot | null }) {
  const [airport, setAirport] = useState('LKPR');
  const [radius, setRadius] = useState(150);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const lat = telemetry?.latitude ?? 50.1008;
  const lon = telemetry?.longitude ?? 14.2632;
  const centerLat = Math.round(lat * 20) / 20;
  const centerLon = Math.round(lon * 20) / 20;
  useEffect(() => {
    const controller = new AbortController();
    let closed = false;
    async function refresh() {
      try {
        const query = new URLSearchParams({ lat: String(centerLat),
          lon: String(centerLon), radiusKm: String(radius), airport });
        const response = await fetch('/api/vatsim/nearby?' + query.toString(),
          { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('network');
        const json = await response.json() as Data;
        if (!closed) { setData(json); setError(false); }
      } catch { if (!closed) setError(true); }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 35000);
    return () => { closed = true; controller.abort(); window.clearInterval(interval); };
  }, [centerLat, centerLon, radius, airport]);

  return <section className="vatsim-center">
    <h2>C16 · VATSIM online provoz</h2>
    <p>Online piloty zobrazujeme pouze ze sítě VATSIM. Nejde o provoz,
      který musí být vidět v MSFS. Hlasové připojení ani VATSIM klient nejsou součástí.</p>
    <div className="vatsim-filters">
      <label>ATC podle letiště
        <input value={airport} maxLength={4} onChange={e =>
          setAirport(e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4))} />
      </label>
      <label>Okruh kolem {telemetry ? 'letadla' : 'Prahy (bez telemetrie)'}
        <select value={radius} onChange={e => setRadius(Number(e.target.value))}>
          <option value={50}>50 km</option><option value={150}>150 km</option>
          <option value={300}>300 km</option><option value={500}>500 km</option>
        </select>
      </label>
    </div>
    {error && <p role="alert">VATSIM nelze načíst; zobrazená data mohou být starší.</p>}
    {data && <>
      <p role="status">{data.available ? `Online v okolí: ${data.pilots.length} pilotů`
        : 'Čekám na VATSIM feed.'}
        {data.updatedAt && ` · Aktualizováno: ${new Date(data.updatedAt).toLocaleTimeString('cs-CZ')}`}
        {data.stale ? ' · Starší data' : ''}</p>
      <h3>Piloti ve vybraném okruhu</h3>
      <div className="vatsim-cards">
        {data.pilots.map(p => <article key={p.callsign}>
          <strong>{p.callsign} · {p.aircraft || '—'}</strong>
          <span>{p.altitudeFeet} ft · {p.groundSpeedKt} kt · kurz {p.heading}°</span>
        </article>)}
        {!data.pilots.length && <p>Žádní piloti v okolí nebo feed není dostupný.</p>}
      </div>
      <h3>ATC {airport || '–'} (prefix volacího znaku)</h3>
      <div className="vatsim-cards">
        {data.controllers.map(c => <article key={c.callsign}>
          <strong>{c.callsign}</strong><span>{c.frequency} MHz · stanoviště {c.facility}</span>
        </article>)}
        {!data.controllers.length && <p>Pro tento prefix nejsou online stanoviště.</p>}
      </div>
    </>}
    <p className="vatsim-note">Přehled používá veřejný datový feed VATSIM.
      Nenavazuje spojení s jeho hlasovou sítí ani neladí automaticky rádio v MSFS.</p>
  </section>;
}
