import { useState } from 'react';
import type { ImportedWaypoint } from '../map/pln';
import './FlightPlanner.css';

export const SESSION_KEY = 'msfs-companion-simbrief-route';
type FlightPlan = {
  origin: string; destination: string; aircraft: string; route: string;
  waypoints: ImportedWaypoint[];
};
export function validCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    Math.abs(lat) <= 85.05 && Math.abs(lon) <= 180;
}

export function parseSimBrief(xml: string): FlightPlan {
  if (xml.length > 4_000_000) throw new Error('OFP je příliš velký.');
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror') || !document.querySelector('OFP'))
    throw new Error('SimBrief nevrátil platný OFP.');
  const field = (parent: Element | null, key: string) =>
    parent?.querySelector(key)?.textContent?.trim() ?? '';
  const summary = document.querySelector('general');
  const points: ImportedWaypoint[] = [];
  for (const node of Array.from(document.querySelectorAll('navlog > fix')).slice(0, 400)) {
    const latitude = Number(field(node, 'pos_lat'));
    const longitude = Number(field(node, 'pos_long'));
    const id = field(node, 'ident');
    if (!field(node, 'pos_lat') || !field(node, 'pos_long') || !validCoord(latitude, longitude))
      continue;
    points.push({ id: /^[\w -]{1,24}$/.test(id) ? id : 'WPT', latitude, longitude });
  }
  return {
    origin: field(document.querySelector('origin'), 'icao_code'),
    destination: field(document.querySelector('destination'), 'icao_code'),
    aircraft: field(document.querySelector('aircraft'), 'icaocode'),
    route: field(summary, 'route'),
    waypoints: points,
  };
}

export default function FlightPlanner() {
  const [pilotId, setPilotId] = useState('');
  const [plan, setPlan] = useState<FlightPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!/^\d{1,7}$/.test(pilotId) || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/flightplans/simbrief/' + pilotId, { cache: 'no-store' });
      if (!response.ok) throw new Error('SimBrief OFP nelze načíst (HTTP ' + response.status + ').');
      const parsed = parseSimBrief(await response.text());
      setPlan(parsed);
      if (parsed.waypoints.length >= 2)
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed.waypoints));
      else window.sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { setPlan(null); setError(e instanceof Error ? e.message : 'Import selhal.'); }
    finally { setBusy(false); }
  };

  return <section className="flight-planner">
    <h2>Poslední letový plán ze SimBrief</h2>
    <p>Vložte svůj SimBrief Pilot ID a klikněte na načtení. Není potřeba heslo.
      Načítáme pouze na požádání, automatické dotazování není zapnuté.</p>
    <div className="flight-planner-actions">
      <label>SimBrief Pilot ID
        <input type="text" inputMode="numeric" value={pilotId} maxLength={7}
          onChange={e => setPilotId(e.target.value.replace(/\D/g, '').slice(0,7))}
          placeholder="Například 123456" />
      </label>
      <button type="button" disabled={busy || !/^\d{1,7}$/.test(pilotId)}
        onClick={() => void load()}>{busy ? 'Načítám…' : 'Importovat poslední OFP'}</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {plan && <div className="flight-planner-summary">
      <h3>{plan.origin || '—'} → {plan.destination || '—'}</h3>
      <p>Typ letadla: {plan.aircraft || 'neuveden'}</p>
      <p>Trasa: {plan.route || 'bez textové trasy'}</p>
      <p>GPS souřadnice: {plan.waypoints.length} bodů z navigačního logu.</p>
      {plan.waypoints.length >= 2 ? <a href="/map">Zobrazit plánovanou trasu na mapě</a>
        : <p>Není dostatek bodů se souřadnicemi pro vykreslení celé trasy.</p>}
    </div>}
    <p className="flight-planner-note">Importovaná trasa zůstane pouze v relaci tohoto
      prohlížeče. Nezasahuje do flight planu uvnitř MSFS ani nepřepisuje GPS waypoint.</p>
  </section>;
}
