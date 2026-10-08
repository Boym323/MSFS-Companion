import { useEffect, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import './LiveValidation.css';

type Scenario = {id:string; title:string; instructions:string};
const scenarios: Scenario[] = [
  {id:'connect',title:'Živá telemetrie a reconnect',instructions:'Spusť MSFS, sleduj skutečná data, odpoj a znovu připoj simulátor.'},
  {id:'systems',title:'SimVars a přepínače',instructions:'Porovnej rychlost, výšku, klapky, motor a palivo se skutečným kokpitem.'},
  {id:'nav',title:'GPS Direct-To a legy',instructions:'Aktivuj plán alespoň tří bodů, Direct-To a přepnutí legu; porovnej /map a /progress.'},
  {id:'avionics',title:'Input Events a readback',instructions:'Na konkrétním letadle zkontroluj skutečně enumerované ovladače a jejich účinek.'},
  {id:'traffic',title:'Okolní AI letadla',instructions:'S aktivním AI provozem povol vrstvu MSFS Traffic a zkontroluj polohy, vypnutí a obnovu.'},
  {id:'landing',title:'Přistání / vodní dosednutí',instructions:'Porovnej touchdown, G-force a onGround; XCub Floats otestuj i na vodě.'},
  {id:'update',title:'Instalace a LAN aktualizace',instructions:'Ověř start tray, mDNS, firewall a obnovení spojení po aktualizaci; rollback zatím netestuj bez zálohy.'}
];
type Assessment = {result:'pass'|'fail'|'not-tested';note:string};
type Saved = Record<string,Assessment>;
function load(key:string):Saved{
  try{const raw=localStorage.getItem(key); const parsed=raw?JSON.parse(raw):{}; return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};}
  catch{return {};}
}
export default function LiveValidation({telemetry,live}:{telemetry:TelemetrySnapshot|null;live:boolean}) {
  const aircraft=live&&telemetry?.aircraft?telemetry.aircraft:'neověřené letadlo';
  const key='kokpit-c31-validation:'+aircraft.slice(0,100);
  const [checks,setChecks]=useState<Saved>(()=>load(key));
  useEffect(()=>{setChecks(load(key));},[key]);
  const update=(id:string,next:Assessment)=>{
    setChecks(old=>{const value={...old,[id]:next};try{localStorage.setItem(key,JSON.stringify(value));}catch{}return value;});
  };
  function download(){
    const report={schema:1,exportedAtUtc:new Date().toISOString(),aircraft,liveAtExport:live,
      note:'Ruční pozorování, nikoli automatická certifikace.',checks:scenarios.map(s=>({
        id:s.id,title:s.title,...(checks[s.id]||{result:'not-tested',note:''})}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='kokpit-c31-validace.json';
    document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="live-validation">
    <h2>C31 · Ověření na skutečném MSFS 2020</h2>
    <p>Výsledky zapisuje pilot ručně a ukládají se pouze v tomto prohlížeči.
      Nejde o automatické tvrzení, že konkrétní avionika funguje.</p>
    <p role="status">Zdroj: <strong>{live?'SIMCONNECT LIVE':'NEOVĚŘENO / OFFLINE'}</strong>
      {' · '}Letadlo: <strong>{aircraft}</strong></p>
    {scenarios.map(s=><article key={s.id}>
      <h3>{s.title}</h3><p>{s.instructions}</p>
      <label>Výsledek <select value={checks[s.id]?.result||'not-tested'} onChange={e=>
        update(s.id,{result:e.target.value as Assessment['result'],note:checks[s.id]?.note||''})}>
        <option value="not-tested">Netestováno</option><option value="pass">Ručně ověřeno</option>
        <option value="fail">Nefunguje / odchylka</option></select></label>
      <label>Poznámka <input maxLength={500} value={checks[s.id]?.note||''}
        onChange={e=>update(s.id,{result:checks[s.id]?.result||'not-tested',note:e.target.value})}
        placeholder="Verze MSFS, avionika, zjištěný výsledek..." /></label>
    </article>)}
    <button type="button" onClick={download}>Exportovat výsledky validace JSON</button>
    <p>Export uvádí název letadla a pilotovy poznámky. Před sdílením zkontrolujte osobní údaje.
      Samotný export neobsahuje GPS historii ani hesla.</p>
  </section>;
}