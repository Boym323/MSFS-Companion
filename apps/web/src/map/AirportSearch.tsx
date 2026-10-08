import { useEffect, useState } from 'react';

type Result = { available: boolean; airports: {
  ident: string; name: string; airportType: string; latitude: number; longitude: number;
}[] };

export default function AirportSearch({ onSelect }: { onSelect: (ident: string) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Result | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) { setFound(null); return; }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/map/aviation/search?q=' + encodeURIComponent(q.trim()),
          { cache: 'no-store', signal: controller.signal });
        if (!res.ok) throw new Error();
        const data = await res.json() as Result;
        if (!cancelled) setFound(data);
      } catch { if (!cancelled) setFound(null); }
    }, 350);
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [q]);
  return <div className="airport-search">
    <label>Vyhledat letiště podle ICAO nebo názvu
      <input value={q} onChange={event => setQ(event.target.value.slice(0,70))}
        placeholder="Např. LKPR nebo Praha" maxLength={70} />
    </label>
    {found && <div className="airport-search-results" role="status">
      {!found.available ? 'Databáze letišť se ještě načítá.' :
        found.airports.length ? found.airports.map(airport =>
          <button type="button" key={airport.ident}
            onClick={() => onSelect(airport.ident)}>
            {airport.ident} · {airport.name}
          </button>) : 'Žádná letiště nenalezena.'}
    </div>}
  </div>;
}
