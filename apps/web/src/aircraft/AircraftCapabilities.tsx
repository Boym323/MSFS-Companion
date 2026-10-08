import { useEffect, useState } from 'react';

type Entry = {
  id: string; name: string; avionics: string; inputEvent: string;
  enumerated: boolean; rotary: boolean;
};
type Status = {
  connected: boolean; status: string;
  aircraft?: string; scannedAt?: string | null;
  assessment?: { state: string; aircraftMatches: boolean; scanFresh: boolean;
    commandsConfirmed: boolean; enumeratedCount: number; candidateCount: number;
    reason: string | null };
  profile: { id: string; label: string; avionics: string; note: string };
  entries: Entry[];
};

export default function AircraftCapabilities({ live }: { live: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    if (!live) { setStatus(null); return; }
    let dead = false;
    async function refresh() {
      try {
        const response = await fetch('/api/aircraft/capabilities', { cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json() as Status;
        if (!dead) setStatus(data);
      } catch { if (!dead) setStatus(null); }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { dead = true; window.clearInterval(timer); };
  }, [live]);
  const ready = status?.entries.filter(e => e.enumerated) ?? [];
  return <section>
    <h2>C13 · Katalog ovládání letadel</h2>
    <p>Vlastní katalog standardních SimConnect Input Events, bez instalace MobiFlight
      či kopírování neověřených skriptů HubHop. Dostupnost je zjištěna přímo v kokpitu.</p>
    <p role="status">{!live ? 'Simulátor není připojen.'
      : status ? `${status.profile.label} · ${status.profile.avionics} · skutečně dostupné: ${ready.length}/${status.entries.length}`
      : 'Zjišťuji kompatibilitu…'}</p>
    {status?.connected && <>
      <p>{status.profile.note}</p>
      <div className="compatibility-lab">
        <h3>C22 · Diagnostika kompatibility</h3>
        <p>Aktuální TITLE: <strong>{status.aircraft || '—'}</strong></p>
        <p>Poslední enumerace: {status.scannedAt
          ? new Date(status.scannedAt).toLocaleString('cs-CZ') : 'zatím neprovedena'}</p>
        <p role="status">Výsledek: <strong>{status.assessment?.state || status.status}</strong>
          {' · '}{status.assessment?.reason}</p>
        <p>Přesnost: {status.assessment?.aircraftMatches ? 'Shoda letadla' : 'Identita neověřena'}
          {' · '}{status.assessment?.scanFresh ? 'Aktuální scan' : 'Scan neaktuální'}
          {' · '}Ovládací účinek: {status.assessment?.commandsConfirmed
            ? 'Potvrzený' : 'NEPOTVRZENÝ (žádný automatický test)'}
        </p>
      </div>
      {status.entries.length === 0
        ? <p>Pro tento typ letadla zatím nemáme ověřený profil. Stávající PFD a rádio fungují dál.</p>
        : <div className="capability-list">
          {status.entries.map(entry => <div key={entry.id} className="capability-row">
            <strong>{entry.name}</strong>
            <span>{entry.avionics.toUpperCase()} · {entry.inputEvent}</span>
            <span>{entry.enumerated ? 'Enumerováno v MSFS (bez readbacku)' : 'Nezjištěno / nepodporováno'}</span>
          </div>)}
        </div>}
    </>}
    <p>Seznam je pouze diagnostický. Samotný katalog nepovoluje žádné příkazy
      ani neinterpretuje cizí RPN skripty.</p>
  </section>;
}
