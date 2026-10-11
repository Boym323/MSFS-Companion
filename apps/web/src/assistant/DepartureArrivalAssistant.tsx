import {useEffect,useState} from 'react';
import {readFlightBrief} from '../planning/flightBrief';
import './DepartureArrivalAssistant.css';
type AirportWeather = {airport:string;available:boolean;stale:boolean;
  fetchedAt:string;metar:string|null;taf:string|null;error:string|null};
type WeatherState = Record<string,AirportWeather|null>;
export default function DepartureArrivalAssistant(){
  const [brief]=useState(readFlightBrief);
  const [weather,setWeather]=useState<WeatherState>({});
  useEffect(()=>{
    if(!brief)return;
    const controller=new AbortController();
    const airports=[brief.origin,brief.destination];
    for(const airport of airports){
      void fetch('/api/weather/'+encodeURIComponent(airport),{cache:'no-store',
        signal:controller.signal}).then(async response=>{
          if(!response.ok)throw new Error('NOAA offline');
          return await response.json() as AirportWeather;
        }).then(data=>{
          if(!controller.signal.aborted) setWeather(old=>({...old,[airport]:
            data.airport===airport?data:null}));
        }).catch(()=>{if(!controller.signal.aborted)setWeather(old=>({...old,[airport]:null}));});
    }
    return ()=>controller.abort();
  },[brief]);
  if(!brief)return <section className="departure-arrival-assistant">
    <h3>Odlet a přílet</h3>
    <p>Pro kontextové údaje nejprve načtěte plán v <a href="/flight-plan">SimBrief</a>.
      Letiště nelze bezpečně odvozovat pouze z GPS polohy.</p>
  </section>;
  return <section className="departure-arrival-assistant" aria-label="Kontext odletu a příletu">
    <div className="departure-arrival-title">
      <h3>Odlet a přílet · podle importovaného OFP</h3>
      <small>Plán, ne potvrzené letiště v avionice</small>
    </div>
    <div className="departure-arrival-grid">
      {([['Odlet',brief.origin],['Přílet',brief.destination]] as const).map(([label,icao])=>{
        const result=weather[icao];
        return <article key={label}>
          <span>{label}</span><strong>{icao}</strong>
          <p>{result?.available && !result.stale && result.metar
            ?result.metar.slice(0,260)
            :result?.stale?'NOAA: starší meteorologická data – neaktuální.'
            :'Aktuální METAR není potvrzený.'}</p>
          <a href={'/briefing?icao='+encodeURIComponent(icao)}>Detail letiště a drah →</a>
        </article>;
      })}
    </div>
    {brief.alternate&&<p>Plánované alternativní letiště:
      {' '}<a href={'/briefing?icao='+brief.alternate}>{brief.alternate}</a></p>}
    <p>Ověřte aktuální dráhu, ATC a podmínky přímo v MSFS.
      Veřejná meteorologická data se mohou lišit od počasí simulátoru.</p>
  </section>;
}
