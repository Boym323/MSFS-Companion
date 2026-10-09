import { useEffect, useState } from 'react';
import AirportSearch from '../map/AirportSearch';
import AviationAirportDetails from '../map/AviationAirportDetails';
import type { AirportDetail } from '../map/useAviationFeatures';
import { calculateRunwayWind, freshMetarWind } from './runwayWind';
import './AirportBriefing.css';

type Weather = {airport:string;metar:string|null;taf:string|null;
  available:boolean;fetchedAt:string;stale:boolean;error:string|null};

export default function AirportBriefing(){
  const [airport,setAirport]=useState('LKPR');
  const [weather,setWeather]=useState<Weather|null>(null);
  const [detail,setDetail]=useState<AirportDetail|null>(null);
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
  const validWeather=weather?.airport===airport?weather:null;
  const wind=validWeather?freshMetarWind(validWeather.metar,airport,
    validWeather.fetchedAt,validWeather.available,validWeather.stale,Date.now()):null;
  const assessments=wind&&detail?.airport.ident===airport
    ?calculateRunwayWind(detail.runways,wind):[];
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
      <AviationAirportDetails ident={airport} onClose={()=>setAirport('')}
        onDetail={setDetail}/>
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
      <section className="airport-briefing-wind">
        <h3>C47 · Vítr vzhledem k drahám</h3>
        {wind&&detail?.airport.ident===airport?<p>
          METAR: {wind.calm?'klid':wind.direction===null?'proměnlivý směr':
          wind.direction.toString().padStart(3,'0')+'° skutečný'} ·
          {' '}{wind.speedKnots} kt
          {wind.gustKnots!==null?' · nárazy '+wind.gustKnots+' kt':''}.
        </p>:<p>Spolehlivé aktuální údaje o větru nebo o dráhách nejsou k dispozici.
          U starších či nedostupných zpráv se odhady nezobrazují.</p>}
        {wind&&!wind.calm&&wind.direction===null&&<p>
          METAR hlásí proměnlivý směr (VRB); nelze spočítat složky pro konkrétní dráhu.</p>}
        {assessments.length>0&&<div className="airport-briefing-runways">
          {assessments.map((item,i)=><div key={item.ident+'-'+i}>
            <strong>RWY {item.ident}</strong>
            <span>Skutečný směr {item.trackTrue}°</span>
            <span>{item.headwindKnots>=0?'Protivítr':'Zadní vítr'}:
              {' '}{Math.abs(item.headwindKnots).toFixed(1)} kt</span>
            <span>Boční složka: {Math.abs(item.crosswindKnots).toFixed(1)} kt
              {' · '}{item.crosswindKnots>0?'zprava':item.crosswindKnots<0?'zleva':'bez boční složky'}</span>
            {item.gustHeadwindKnots!==null&&item.gustCrosswindKnots!==null&&<span>
              Náraz: podélně {item.gustHeadwindKnots.toFixed(1)} kt,
              {' '}bočně {Math.abs(item.gustCrosswindKnots).toFixed(1)} kt</span>}
          </div>)}
        </div>}
        <p>Výpočet používá skutečný zeměpisný směr z krajních souřadnic drah
          OurAirports a směr větru z NOAA METAR. Nezohledňuje aktivní dráhu,
          NOTAM, limity konkrétního letadla ani ATC. Pouze pro simulátor.</p>
      </section>
    </>}
  </section>;
}
