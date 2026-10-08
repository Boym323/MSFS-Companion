import { useEffect, useState } from 'react';

type WeatherReport = {
  airport: string; metar: string | null; taf: string | null;
  fetchedAt: string; available: boolean; source: string;
  stale: boolean; error: string | null;
};
export default function AviationWeather() {
  const [icao, setIcao] = useState('LKPR');
  const [selected, setSelected] = useState('LKPR');
  const [data, setData] = useState<WeatherReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!/^[A-Z]{4}$/.test(selected)) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    void fetch('/api/weather/' + selected, { cache: 'no-store', signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error('NOAA není dostupná.');
        return await r.json() as WeatherReport;
      })
      .then(r => { if (!controller.signal.aborted) setData(r); })
      .catch(() => { if (!controller.signal.aborted) setError('Počasí se nepodařilo načíst.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [selected]);
  return <section className="weather-panel">
    <h2>C15 · Letové počasí</h2>
    <p>Aktuální METAR a TAF ze služby NOAA Aviation Weather Center.
      Počasí v reálném světě nemusí přesně odpovídat simulovanému počasí v MSFS.</p>
    <form className="weather-form" onSubmit={event => {
      event.preventDefault(); if (/^[A-Z]{4}$/.test(icao)) setSelected(icao);
    }}>
      <label>ICAO letiště
        <input value={icao} maxLength={4} autoCapitalize="characters"
          onChange={e => setIcao(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}
          placeholder="LKPR" />
      </label>
      <button type="submit" disabled={!/^[A-Z]{4}$/.test(icao)}>Načíst počasí</button>
    </form>
    {loading && <p role="status">Načítám aktuální METAR a TAF…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <div className="weather-reports">
      <p><strong>{data.airport}</strong> · {data.source} ·
        {' '}poslední použitelná data {new Date(data.fetchedAt).toLocaleString('cs-CZ')}</p>
      {data.stale && <p role="status" className="weather-stale">
        Upozornění: počasí nemusí být aktuální. Některé údaje se nepodařilo obnovit.
        {data.error ? ' ' + data.error : ''}
      </p>}
      {!data.available && <p role="status">NOAA pro toto letiště zatím nemá dostupný METAR ani TAF.</p>}
      <article><h3>METAR</h3><pre>{data.metar || 'METAR není dostupný.'}</pre></article>
      <article><h3>TAF</h3><pre>{data.taf || 'TAF není dostupný.'}</pre></article>
      <p>Výpis je meteorologická informace, nikoliv skutečné nastavení počasí v simulátoru.</p>
    </div>}
  </section>;
}
