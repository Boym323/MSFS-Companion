import { useCallback, useEffect, useState } from 'react';
import './CockpitControls.css';

type Access = { enabled: boolean; paired: boolean; canControl: boolean; local: boolean };
type Local = { enabled: boolean; pairCode: string | null };
type RadioValues = {
  com1ActiveMHz: number; com1StandbyMHz: number;
  com2ActiveMHz: number; com2StandbyMHz: number;
  nav1ActiveMHz: number; nav1StandbyMHz: number;
  nav2ActiveMHz: number; nav2StandbyMHz: number;
};
type RadioStatus = { connected: boolean; radios: RadioValues | null; transponderCode: string | null };
type Systems = {
  autopilotMaster: boolean;
  autopilotSelectedHeadingDegrees: number;
  autopilotSelectedAltitudeFeet: number;
  autopilotSelectedVerticalSpeedFpm: number;
};
type SystemStatus = { connected: boolean; systems: Systems | null };
type ApModesStatus = { connected: boolean; modes: {
  heading: boolean; nav: boolean; altitude: boolean; verticalSpeed: boolean;
} | null };

const key = 'msfs-companion-control-session';
const getToken = () => window.sessionStorage.getItem(key) ?? '';
const mhz = (value: number | undefined) => value !== undefined && value > 0 && Number.isFinite(value)
  ? value.toFixed(3) + ' MHz' : '—';

export default function CockpitControls({ live }: { live: boolean }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [local, setLocal] = useState<Local | null>(null);
  const [radio, setRadio] = useState<RadioStatus | null>(null);
  const [systems, setSystems] = useState<SystemStatus | null>(null);
  const [modes, setModes] = useState<ApModesStatus | null>(null);
  const [code, setCode] = useState('');
  const [frequency, setFrequency] = useState<Record<string, string>>({
    com1: '118.500', com2: '118.500', nav1: '110.50', nav2: '110.50',
  });
  const [xpdr, setXpdr] = useState('1200');
  const [heading, setHeading] = useState('270');
  const [altitude, setAltitude] = useState('5000');
  const [vs, setVs] = useState('0');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (getToken()) headers['X-MSFS-Control-Token'] = getToken();
    const [a, r, s, m] = await Promise.all([
      fetch('/api/controls/status', { headers, cache: 'no-store' }),
      fetch('/api/radios', { cache: 'no-store' }),
      fetch('/api/aircraft/systems', { cache: 'no-store' }),
      fetch('/api/autopilot/modes', { cache: 'no-store' }),
    ]);
    if (!a.ok || !r.ok || !s.ok || !m.ok) throw new Error('Bridge není dostupný');
    const auth = await a.json() as Access;
    setAccess(auth);
    setRadio(await r.json() as RadioStatus);
    setSystems(await s.json() as SystemStatus);
    setModes(await m.json() as ApModesStatus);
    if (auth.local) {
      const response = await fetch('/api/controls/local', { cache: 'no-store' });
      if (response.ok) setLocal(await response.json() as Local);
    } else {
      setLocal(null);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    const update = async () => {
      try { if (!stopped) await refresh(); }
      catch { if (!stopped) { setAccess(null); setRadio(null); setSystems(null); setModes(null); } }
    };
    void update();
    const timer = window.setInterval(() => void update(), 1800);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [refresh]);

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      const response = await fetch('/api/controls/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MSFS-Companion-Action': 'control-local' },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) throw new Error('Změna ovládání byla odmítnuta.');
      window.sessionStorage.removeItem(key);
      setMessage(enabled ? 'Ochrana zapnuta. Pro ovládání na iPadu je nyní nutné párování.' : 'Ochrana vypnuta. Ovládání je dostupné z důvěryhodné LAN.');
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Chyba'); }
    finally { setBusy(false); }
  }

  async function pair() {
    if (!/^\d{6}$/.test(code)) { setMessage('Párovací kód musí mít šest číslic.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/controls/pair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!response.ok) throw new Error('Kód je chybný, expiroval nebo je omezen počet pokusů.');
      const result = await response.json() as { token: string };
      window.sessionStorage.setItem(key, result.token);
      setCode('');
      setMessage('Zařízení spárováno pro tuto relaci.');
      await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Párování selhalo.'); }
    finally { setBusy(false); }
  }

  async function send(command: string, value?: number) {
    if (!access?.canControl || !live || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/controls/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MSFS-Control-Token': getToken(),
        },
        body: JSON.stringify({ command, ...(value === undefined ? {} : { value }) }),
      });
      if (!response.ok) {
        if (response.status === 401) window.sessionStorage.removeItem(key);
        throw new Error(response.status === 429 ? 'Příkazy posíláte příliš rychle.'
          : response.status === 409 ? 'Simulátor není připojen.'
          : response.status === 400 ? 'Hodnota není povolená.'
          : 'Příkaz nebyl přijat (HTTP ' + response.status + ').');
      }
      setMessage('Povel odeslán; skutečnou změnu potvrzují až údaje MSFS.');
      window.setTimeout(() => void refresh().catch(() => undefined), 700);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Chyba ovládání'); }
    finally { setBusy(false); }
  }

  const canSend = !!access?.canControl && live && !busy;
  const selected = systems?.connected ? systems.systems : null;
  const rv = radio?.connected ? radio.radios : null;
  const ap = modes?.connected ? modes.modes : null;

  const radios = (['com1', 'com2', 'nav1', 'nav2'] as const).map((name) => {
    const label = name.toUpperCase();
    const active = rv?.[`${name}ActiveMHz` as keyof RadioValues];
    const standby = rv?.[`${name}StandbyMHz` as keyof RadioValues];
    return <section key={name} className="control-tile">
      <h3>{label}</h3>
      <div className="control-numbers"><span>Aktivní: <b>{mhz(active)}</b></span><span>Standby: <b>{mhz(standby)}</b></span></div>
      <label>Nová standby frekvence (MHz)
        <input type="number" inputMode="decimal" min={name.startsWith('com') ? '118' : '108'}
          max={name.startsWith('com') ? '136.99' : '117.95'}
          step={name.startsWith('com') ? '0.005' : '0.05'}
          value={frequency[name]} onChange={e => setFrequency(f => ({ ...f, [name]: e.target.value }))} />
      </label>
      <div className="control-actions">
        <button type="button" disabled={!canSend} onClick={() =>
          void send(`radio.${name}.set`, Math.round(Number(frequency[name]) * 1_000_000))}>
          Nastavit standby
        </button>
        <button type="button" disabled={!canSend} onClick={() => void send(`radio.${name}.swap`)}>
          Přepnout ⇄
        </button>
      </div>
    </section>;
  });

  return <div className="cockpit-controls">
    <section className="control-security">
      <h2>Zabezpečení v důvěryhodné LAN</h2>
      <p>Ve výchozím nastavení je <strong>párování vypnuté</strong> a zařízení ve stejné
        důvěryhodné domácí podsíti mohou ovládat kokpit přímo. Volitelnou ochranu lze zapnout
        přímo na Windows PC na adrese <code>http://127.0.0.1:8765/controls</code>.
        Omezení na lokální síť, povolené příkazy a kontrola hodnot zůstávají aktivní.</p>
      <p><strong>Ochrana:</strong> {!access ? 'Bridge nedostupný'
        : !access.enabled ? 'Vypnuta · bez párování'
        : access.paired ? 'Zapnuta · zařízení spárováno'
        : 'Zapnuta · zařízení nespárováno'}</p>
      {access?.local && <div className="control-actions">
        <button type="button" disabled={busy || access.enabled} onClick={() => void toggle(true)}>
          Zapnout ochranu (párování)
        </button>
        <button type="button" disabled={busy || !access.enabled} onClick={() => void toggle(false)}>
          Vypnout ochranu
        </button>
        {local?.pairCode && <p className="control-pair-code">Kód pro iPad (3 min): <b>{local.pairCode}</b></p>}
      </div>}
      {access?.enabled && !access.paired && <div className="control-pair">
        <label>Kód z Windows PC
          <input inputMode="numeric" pattern="[0-9]*" maxLength={6} value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </label>
        <button type="button" disabled={busy || code.length !== 6} onClick={() => void pair()}>Spárovat zařízení</button>
      </div>}
      {!live && <p>MSFS 2020 není živě připojen. V mock režimu nelze odesílat příkazy.</p>}
      {message && <p role="status" className="control-message">{message}</p>}
    </section>
    <h2>C1 · COM/NAV a transpondér</h2>
    <div className="control-grid">{radios}</div>
    <section className="control-tile">
      <h3>Transpondér</h3>
      <p>Skutečný kód z MSFS: <strong>{radio?.connected ? (radio.transponderCode ?? '—') : '—'}</strong>. Ověřte také v kokpitu.</p>
      <label>Kód squawk
        <input inputMode="numeric" maxLength={4} value={xpdr}
          onChange={e => setXpdr(e.target.value.replace(/[^0-7]/g, '').slice(0, 4))} />
      </label>
      <div className="control-actions"><button type="button" disabled={!canSend || xpdr.length !== 4}
        onClick={() => void send('transponder.code.set', Number(xpdr))}>Nastavit XPDR</button></div>
    </section>
    <h2>C2 · Autopilot</h2>
    <section className="control-tile">
      <p>Skutečný stav AP: <strong>{selected ? (selected.autopilotMaster ? 'ZAPNUTO' : 'VYPNUTO') : '—'}</strong></p>
      <p>Potvrzené režimy: HDG <strong>{ap ? (ap.heading ? 'ON' : 'OFF') : '—'}</strong>
        {' · '} NAV <strong>{ap ? (ap.nav ? 'ON' : 'OFF') : '—'}</strong>
        {' · '} ALT <strong>{ap ? (ap.altitude ? 'ON' : 'OFF') : '—'}</strong>
        {' · '} VS <strong>{ap ? (ap.verticalSpeed ? 'ON' : 'OFF') : '—'}</strong></p>
      <div className="control-actions">
        {(['autopilot.on', 'autopilot.off', 'autopilot.hdg.on', 'autopilot.hdg.off',
          'autopilot.nav.on', 'autopilot.nav.off', 'autopilot.alt.on', 'autopilot.alt.off',
          'autopilot.vs.on', 'autopilot.vs.off'] as const).map((command, i) =>
          <button key={command} type="button" disabled={!canSend}
            onClick={() => void send(command)}>
            {['AP zapnout', 'AP vypnout', 'HDG ON', 'HDG OFF', 'NAV ON', 'NAV OFF',
              'ALT ON', 'ALT OFF', 'VS ON', 'VS OFF'][i]}
          </button>)}
      </div>
      <div className="control-grid control-grid--values">
        {[
          { title: 'Kurz HDG (°)', key: 'autopilot.heading.set', value: heading, set: setHeading,
            actual: selected?.autopilotSelectedHeadingDegrees, min: 0, max: 359, step: 1 },
          { title: 'Zvolená výška (ft)', key: 'autopilot.altitude.set', value: altitude, set: setAltitude,
            actual: selected?.autopilotSelectedAltitudeFeet, min: -1000, max: 60000, step: 100 },
          { title: 'Vertikální rychlost (fpm)', key: 'autopilot.vs.set', value: vs, set: setVs,
            actual: selected?.autopilotSelectedVerticalSpeedFpm, min: -6000, max: 6000, step: 100 },
        ].map(field => <div key={field.key}>
          <label>{field.title} · MSFS: {field.actual === undefined ? '—' : field.actual.toFixed(0)}
            <input type="number" inputMode="numeric" min={field.min} max={field.max} step={field.step}
              value={field.value} onChange={e => field.set(e.target.value)} />
          </label>
          <button type="button" disabled={!canSend || !field.value}
            onClick={() => void send(field.key, Number(field.value))}>Nastavit</button>
        </div>)}
      </div>
    </section>
    <p className="control-disclaimer">Pouze simulátor. Standardní události nemusí fungovat ve všech letadlech;
      aktuální stav je vždy nutné ověřit ve skutečné telemetrii MSFS, nikoliv podle stisku tlačítka.</p>
  </div>;
}
