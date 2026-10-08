import { useEffect, useState } from 'react';
import './AdvancedAvionics.css';

type Availability = { status: string; aircraft: string | null; availableActions: string[] };
type Action = { id: string; label: string; rotary: boolean };
const catalog: Record<string, Action[]> = {
  g3x: [
    ...['left.outer','left.inner','right.outer','right.inner'].map(name =>
      ({ id: 'g3x.' + name, label: name.replace('.', ' '), rotary: true })),
    ...['directto','nearest','back','menu'].map(name =>
      ({ id: 'g3x.' + name, label: name, rotary: false })),
  ],
  g3000: [
    ...(['pfd','mfd'] as const).flatMap(display => Array.from({ length: 12 }, (_, index) =>
      ({ id: `g3000.${display}.softkey.${index+1}`, label: `${display.toUpperCase()} SK${index+1}`, rotary: false }))),
    { id: 'g3000.tsc.freq.mhz', label: 'TSC MHz', rotary: true },
    { id: 'g3000.tsc.freq.khz', label: 'TSC kHz', rotary: true },
    { id: 'g3000.tsc.swap', label: 'TSC Swap', rotary: false },
  ],
  gns530: [
    ...['directto','menu','ent','fpl'].map(name => ({ id: 'gns530.'+name, label: name, rotary:false })),
    ...['outer','inner'].map(name => ({ id: 'gns530.'+name, label:name, rotary:true })),
  ],
};

export default function AdvancedAvionics({ live }: { live: boolean }) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [family, setFamily] = useState('g3x');
  useEffect(() => {
    if (!live) { setAvailability(null); return; }
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/avionics/advanced', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const json = await res.json() as Availability;
        if (!cancelled) setAvailability(json);
      } catch { if (!cancelled) setAvailability(null); }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [live]);

  async function send(id: string, value: number) {
    if (busy || !live || !availability?.availableActions.includes(id)) return;
    setBusy(true); setFeedback('');
    try {
      const res = await fetch('/api/avionics/advanced/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
          'X-MSFS-Control-Token': window.sessionStorage.getItem('msfs-companion-control-session') ?? '' },
        body: JSON.stringify({ id, value }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? 'Příliš rychlé povely.'
        : 'Tento ovladač není pro aktuální letadlo dostupný.');
      setFeedback('Událost odeslána; skutečnou odezvu ověřte v kokpitu MSFS.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Chyba'); }
    finally { setBusy(false); }
  }

  return <section className="advanced-avionics">
    <h2>Další avionika</h2>
    <p>Ovladače jsou kandidátní. Aktivují se pouze pokud je aktuální letadlo
      zveřejní přes SimConnect Input Events. GNS430 vyžaduje vlastní ověření.</p>
    <label>Typ avioniky
      <select value={family} onChange={e => setFamily(e.target.value)}>
        <option value="g3x">Garmin G3X</option>
        <option value="g3000">Garmin G3000</option>
        <option value="gns530">Garmin GNS530</option>
      </select>
    </label>
    <p role="status">{!live ? 'Simulátor offline'
      : availability?.aircraft ? `Letadlo: ${availability.aircraft}`
      : 'Zjišťuji dostupné Input Events…'}</p>
    <div className="advanced-avionics-grid">{catalog[family].map(a => {
      const available = !!live && !busy && !!availability?.availableActions.includes(a.id);
      return <div className="advanced-avionics-item" key={a.id}>
        <span>{a.label}{!availability?.availableActions.includes(a.id) ? ' · nedostupné' : ''}</span>
        {a.rotary ? <div className="advanced-avionics-actions">
          <button type="button" disabled={!available} onClick={() => void send(a.id,-1)}>−</button>
          <button type="button" disabled={!available} onClick={() => void send(a.id,1)}>+</button>
        </div> : <button type="button" disabled={!available} onClick={() => void send(a.id,1)}>Stisk</button>}
      </div>;
    })}</div>
    {feedback && <p role="status">{feedback}</p>}
  </section>;
}
