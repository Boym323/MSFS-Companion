import { useEffect, useState } from 'react';
import AirportSearch from '../map/AirportSearch';
import AviationAirportDetails from '../map/AviationAirportDetails';

type Weather = {airport:string;metar:string|null;taf:string|null;
  available:boolean;fetchedAt:string;stale:boolean;error:string|null};

export default function AirportBriefing(){
  const [airport,setAirport]=useState('LKPR');
  const [weather,setWeather]=useState<Weather|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!/^[A-Z]{4}$/.test(airport)){setWeather(null);return;}
    const abort=new AbortController();
    setWeather(null);setError('');
    void fetch('/api/weather/'+airport,{signal:abort.signal,cache:'no-store'})
      .then(async r=>{if(!r.ok)throw Error();return await r.json() as Weather;})
      .then(d=>{if(!abort.signal.aborted)setWeather(d);})
      .catch(()=>{if(!abort.signal.aborted)setError('NOAA počasí není dostupné.');});
    return()=>abort.abort();
  },[airport]);
  return <section className="airport-briefing">
    <h2>C23 · Letištní briefing</h2>
    <p>Na jednom místě otevřená data OurAirports (dráhy, letištní frekvence)
      a NOAA METAR/TAF. Údaje se mohou lišit od MSFS a nejsou
      podkladem pro skutečnou leteckou navigaci.</p>
    <AirportSearch onSelect={setAirport}/>
    <label>ICAO pro briefing
      <input value={airport} maxLength={4}
        onChange={e=>setAirport(e.target.value.toUpperCase().replace(/[^A-Z]/g,''))}
        placeholder="LKPR"/>
    </label>
    {/^[A-Z]{4}$/.test(airport)&&<>
      <AviationAirportDetails ident={airport} onClose={()=>setAirport('')}/>
      <section className="airport-briefing-weather">
        <h3>Aktuální počasí – {airport}</h3>
        {error&&<p role="alert">{error}</p>}
        {!error&&!weather&&<p>Načítám meteorologické informace…</p>}
        {weather&&<>
          <p>{weather.stale?'Pozor, částečně starší údaje.':'Poslední načtení: '+
            new Date(weather.fetchedAt).toLocaleString('cs-CZ')}</p>
          <strong>METAR</strong><pre>{weather.metar||'Nedostupný'}</pre>
          <strong>TAF</strong><pre>{weather.taf||'Nedostupný'}</pre>
        </>}
      </section>
    </>}
  </section>;
}
