import { useEffect, useState } from 'react';
import type { AirportDetail } from './useAviationFeatures';

export default function AviationAirportDetails({ ident, onClose }: {
  ident: string; onClose: () => void;
}) {
  const [detail, setDetail] = useState<AirportDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let closed = false;
    const controller = new AbortController();
    setDetail(null); setError(false);
    void fetch('/api/map/aviation/airport/' + encodeURIComponent(ident),
      { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        if (!res.ok) throw new Error('Letiště není dostupné.');
        return await res.json() as AirportDetail;
      })
      .then(result => { if (!closed) setDetail(result); })
      .catch(() => { if (!closed) setError(true); });
    return () => { closed = true; controller.abort(); };
  }, [ident]);

  return <section className="moving-map-airport-detail">
    <div className="moving-map-airport-heading">
      <h3>{detail ? `${detail.airport.ident} · ${detail.airport.name}` : ident}</h3>
      <button type="button" onClick={onClose}>Zavřít detail</button>
    </div>
    {error ? <p>Detail letiště není dostupný.</p> : !detail ? <p>Načítám detail letiště…</p> : <>
      <p>Typ: {detail.airport.airportType}
        {' · '}Nadmořská výška: {detail.airport.elevationFeet === null
          ? '—' : Math.round(detail.airport.elevationFeet) + ' ft'}</p>
      <h4>Dráhy</h4>
      {detail.runways.length ? <div className="moving-map-airport-table">
        {detail.runways.map((rwy, index) => <span key={index}>
          <strong>{rwy.lowIdent || '—'}/{rwy.highIdent || '—'}</strong>
          {' · '}{rwy.lengthFeet === null ? 'Délka neuvedena' : Math.round(rwy.lengthFeet) + ' ft'}
          {' · '}{rwy.surface || 'Neznámý povrch'}
        </span>)}
      </div> : <p>Žádné zveřejněné údaje o drahách.</p>}
      <h4>Letištní frekvence</h4>
      {detail.frequencies.length ? <div className="moving-map-airport-table">
        {detail.frequencies.map((freq, index) => <span key={index}>
          <strong>{freq.type}</strong> {freq.frequencyMhz.toFixed(3)} MHz
          {' · '}{freq.description}
        </span>)}
      </div> : <p>Žádné zveřejněné letištní frekvence.</p>}
      <p className="moving-map-aviation-disclaimer">
        Zdroj: OurAirports. Údaje jsou komunitní, nemusí být aktuální ani
        odpovídat databázi MSFS. Nepoužívejte pro skutečnou navigaci.</p>
    </>}
  </section>;
}
