import { useEffect, useState } from 'react';
import './SystemHealth.css';
type Indicator = {id:string;label:string;state:string;detail:string};
type Cache = { available?:boolean; loaded?:boolean; stale?:boolean;
  updatedAt?:string|null;lastError?:string|null;refreshRunning?:boolean;
  airports?:number;cachedAirports?:number;staleReports?:number;note?:string };
type Health = {generatedAt:string;indicators:Indicator[];
  sample:{mode:string;connected:boolean;connectionState:string;sampleRateHz:number;
    incomingRateHz:number;framesSkipped:number;publicationLagMs:number|null;
    samplesPublished:number;lastError:string|null;sampleAgeMs:number|null};
  aviation:Cache;weather:Cache;vatsim:Cache;
  radio:{connected?:boolean};navigation:{connected?:boolean}};
const label=(v:boolean|undefined)=>v===true?'Aktivní':v===false?'Nedostupné':'Neověřeno';
export default function SystemHealth(){
  const [health,setHealth]=useState<Health|null>(null);
  const [problem,setProblem]=useState('');
  useEffect(()=>{
    let stopped=false;
    const fetchState=async()=>{
      try {
        const r=await fetch('/api/health/overview',{cache:'no-store'});
        if(!r.ok)throw Error();
        const payload=await r.json() as Health;
        if(!stopped){setHealth(payload);setProblem('');}
      }catch{if(!stopped)setProblem('Bridge nebo diagnostika není dostupná.');}
    };
    void fetchState();
    const timer=window.setInterval(()=>void fetchState(),10000);
    return()=>{stopped=true;window.clearInterval(timer);};
  },[]);
  const exportReport=()=>{
    if(!health)return;
    // Deliberately exclude raw telemetry position, aircraft names, IPs,
    // browser address, recording paths and any potential credentials.
    const report={
      generatedAt:health.generatedAt,
      indicators:health.indicators,
      telemetry:{mode:health.sample.mode,connected:health.sample.connected,
        sampleRateHz:health.sample.sampleRateHz,
        incomingRateHz:health.sample.incomingRateHz,
        skipped:health.sample.framesSkipped,
        publicationLagMs:health.sample.publicationLagMs},
      aviation:health.aviation,weather:health.weather,vatsim:health.vatsim
    };
    const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='msfs-companion-diagnostika.json';
    document.body.append(link);link.click();link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <section className="system-health">
    <h2>C30 · Diagnostika systému</h2>
    <p>Stav posledních známých dat; nikoliv aktivní test konektivity.
      „Neověřeno“ neznamená, že je externí služba funkční.</p>
    {problem&&<p role="alert">{problem}</p>}
    {health&&<>
      <p>Poslední kontrola: {new Date(health.generatedAt).toLocaleTimeString('cs-CZ')}</p>
      <div className="system-health-grid">
        {health.indicators.map(i=><article key={i.id}>
          <strong>{i.label}</strong><span data-health-state={i.state}>{i.state}</span>
          <p>{i.detail}</p>
        </article>)}
        <article><strong>OurAirports</strong><span>{label(health.aviation.available)}</span>
          <p>{health.aviation.airports??0} letišť v cache;
            {health.aviation.stale?' starší data':' stav cache bez síťového testu'}</p></article>
        <article><strong>NOAA</strong><span>Cache: {health.weather.cachedAirports??0} letišť</span>
          <p>{health.weather.staleReports??0} reportů označených jako starší.</p></article>
        <article><strong>VATSIM</strong><span>{label(health.vatsim.loaded)}</span>
          <p>{health.vatsim.stale?'Starší feed':'Pouze poslední známá cache'}</p></article>
        <article><strong>Rádio</strong><span>{label(health.radio.connected)}</span>
          <p>Stav posledního čtení z bridge.</p></article>
        <article><strong>GPS navigace</strong><span>{label(health.navigation.connected)}</span>
          <p>Stav posledního čtení z bridge.</p></article>
      </div>
      <button type="button" className="system-health-export" onClick={exportReport}>
        Exportovat anonymizovanou diagnostiku JSON
      </button>
    </>}
  </section>;
}
