import { useEffect, useState } from 'react';
import './G1000Remote.css';

type Availability = {
  status: string; aircraft: string | null; checkedAt: string | null;
  availableActions: string[]; error: string | null;
};
type Action = { id: string; label: string; rotary: boolean };
const actions: Action[] = [
  { id: 'pfd.fms.inner', label: 'FMS malý', rotary: true },
  { id: 'pfd.fms.outer', label: 'FMS velký', rotary: true },
  { id: 'pfd.heading', label: 'Heading', rotary: true },
  { id: 'pfd.nav.inner', label: 'NAV malý', rotary: true },
  { id: 'pfd.nav.outer', label: 'NAV velký', rotary: true },
  { id: 'pfd.directto', label: 'Direct-To', rotary: false },
  { id: 'pfd.menu', label: 'Menu', rotary: false },
  { id: 'pfd.clr', label: 'CLR', rotary: false },
  { id: 'mfd.fms.inner', label: 'FMS malý', rotary: true },
  { id: 'mfd.fms.outer', label: 'FMS velký', rotary: true },
  { id: 'mfd.heading', label: 'Heading', rotary: true },
  { id: 'mfd.nav.inner', label: 'NAV malý', rotary: true },
  { id: 'mfd.nav.outer', label: 'NAV velký', rotary: true },
  { id: 'mfd.directto', label: 'Direct-To', rotary: false },
  { id: 'mfd.menu', label: 'Menu', rotary: false },
  { id: 'mfd.clr', label: 'CLR', rotary: false },
];

export default function G1000Remote({ live }: { live: boolean }) {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!live) { setAvailability(null); return; }
    let disposed = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/avionics/g1000', { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data = await res.json() as Availability;
        if (!disposed) setAvailability(data);
      } catch {
        if (!disposed) setAvailability(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [live]);

  async function send(id: string, value: number) {
    if (busy || !live || !availability?.availableActions.includes(id)) return;
    setBusy(true);
    try {
      const response = await fetch('/api/avionics/g1000/command', {
        method: 'POST', headers: {
          'Content-Type': 'application/json',
          'X-MSFS-Control-Token': window.sessionStorage.getItem('msfs-companion-control-session') ?? '',
        },
        body: JSON.stringify({ id, value }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? 'Zapněte párování zařízení.'
        : response.status === 429 ? 'Počkejte před dalším povelem.'
        : 'Událost není podporována nebo SimConnect není dostupný.');
      setFeedback('Událost odeslána – chování ověřte na displeji letadla.');
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'Chyba'); }
    finally { setBusy(false); }
  }

  return <section className="g1000-remote">
    <h2>G1000 · vzdálené ovládání</h2>
    <p>Dostupnost se zjišťuje přímo ze seznamu Input Events aktuálního letadla v MSFS 2020.
      Žádný nepodporovaný ovladač nelze aktivovat.</p>
    <p role="status">Stav: <strong>{!live ? 'Simulátor offline' :
      availability?.status === 'ready' ? 'Detekovány kompatibilní události' :
      availability?.status === 'unsupported' ? 'Pro letadlo nebyly nalezeny G1000 události' :
      availability?.status === 'unavailable' ? 'Input Events nyní nedostupné' : 'Načítám…'}</strong>
      {availability?.aircraft ? ` · ${availability.aircraft}` : ''}</p>
    {(['pfd', 'mfd'] as const).map(display => <div className="g1000-section" key={display}>
      <h3>{display.toUpperCase()}</h3>
      <div className="g1000-grid">{actions.filter(a => a.id.startsWith(display + '.')).map(a => {
        const enabled = live && !busy && !!availability?.availableActions.includes(a.id);
        return <div className="g1000-control" key={a.id}>
          <span>{a.label} {!enabled && !availability?.availableActions.includes(a.id) ? '· nepodporováno' : ''}</span>
          {a.rotary ? <div className="g1000-buttons">
            <button type="button" disabled={!enabled} onClick={() => void send(a.id, -1)}
              aria-label={a.label + ' snížit'}>−</button>
            <button type="button" disabled={!enabled} onClick={() => void send(a.id, 1)}
              aria-label={a.label + ' zvýšit'}>+</button>
          </div> : <button type="button" disabled={!enabled} onClick={() => void send(a.id, 1)}>
            Stisk
          </button>}
        </div>;
      })}</div>
    </div>)}
    {feedback && <p role="status">{feedback}</p>}
    <p className="g1000-help">Příkaz je jen odeslaný Input Event, potvrzení změny není možné odvodit
      z HTTP odpovědi. U variant Garminu se mohou události lišit.</p>
  </section>;
}
