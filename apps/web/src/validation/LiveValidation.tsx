import { useEffect, useRef, useState } from 'react';
import type { TelemetrySnapshot } from '../telemetry/types';
import { buildValidationEvidence, type ValidationEvidence } from './validationEvidence';
import { compareEvidence } from './compareEvidence';
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
  const [capturing,setCapturing]=useState(false);
  const [evidence,setEvidence]=useState<{aircraft:string; snapshot:ValidationEvidence}|null>(null);
  const [baseline,setBaseline]=useState<{aircraft:string; snapshot:ValidationEvidence}|null>(null);
  const [captureMessage,setCaptureMessage]=useState('');
  const captureSequence=useRef(0);
  useEffect(()=>{
    captureSequence.current++;
    setChecks(load(key));
    setCapturing(false);
    setEvidence(null);
    setBaseline(null);
    setCaptureMessage('');
    return ()=>{captureSequence.current++;};
  },[key]);
  const update=(id:string,next:Assessment)=>{
    setChecks(old=>{const value={...old,[id]:next};try{localStorage.setItem(key,JSON.stringify(value));}catch{}return value;});
  };
  async function captureEvidence(asBaseline=false){
    if (!live || capturing) return;
    const sequence=++captureSequence.current;
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),5000);
    setCapturing(true);
    setCaptureMessage('');
    try {
      const [status,systems,navigation]=await Promise.all(
        ['/api/status','/api/aircraft/systems','/api/navigation/current'].map(async url=>{
          const response=await fetch(url,{cache:'no-store',signal:controller.signal});
          if(!response.ok) throw new Error('Diagnostické API není dostupné');
          return await response.json() as unknown;
        }),
      );
      if(sequence!==captureSequence.current) return;
      const snapshot=buildValidationEvidence(status,systems,navigation,new Date().toISOString());
      if (!snapshot.telemetry.live) throw Error('SimConnect není živý');
      if(asBaseline){
        setBaseline({aircraft,snapshot});
        setEvidence(null);
        setCaptureMessage('Výchozí stav zaznamenán. Nyní změňte zvolený přepínač v MSFS a zachyťte stav po změně.');
      } else {
        setEvidence({aircraft,snapshot});
        setCaptureMessage('Technický snímek připraven. Rozdíly nejsou automatickým potvrzením účinku ovladače.');
      }
    } catch {
      if(sequence===captureSequence.current){
        setEvidence(null);
        setCaptureMessage('Diagnostický snímek se nepodařilo načíst. Zkontrolujte spojení s bridge.');
      }
    } finally {
      window.clearTimeout(timeout);
      if(sequence===captureSequence.current) setCapturing(false);
    }
  }
  const comparison=baseline?.aircraft===aircraft && evidence?.aircraft===aircraft
    ? compareEvidence(baseline.snapshot,evidence.snapshot) : null;
  function download(){
    const report={schema:1,exportedAtUtc:new Date().toISOString(),aircraft,liveAtExport:live,
      note:'Ruční pozorování, nikoli automatická certifikace.',
      evidence:evidence?.aircraft===aircraft?evidence.snapshot:null,
      baseline:baseline?.aircraft===aircraft?baseline.snapshot:null,
      comparison:comparison?.comparable?comparison:null,
      checks:scenarios.map(s=>({
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
    <div className="validation-actions">
      <button type="button" onClick={()=>void captureEvidence(true)} disabled={!live||capturing}>
        {capturing?'Načítám diagnostiku…':'1. Zachytit výchozí stav'}
      </button>
      <button type="button" onClick={()=>void captureEvidence(false)} disabled={!live||capturing}>
        {capturing?'Načítám diagnostiku…':'2. Zachytit stav po změně'}
      </button>
      <button type="button" onClick={()=>{setBaseline(null);setEvidence(null);setCaptureMessage('');}}
        disabled={!baseline&&!evidence}>Vymazat porovnání</button>
      <button type="button" onClick={download}>Exportovat výsledky validace JSON</button>
    </div>
    {captureMessage&&<p role="status">{captureMessage}</p>}
    {comparison&&<section className="validation-comparison">
      <h3>C41 · Porovnání před změnou a po změně</h3>
      {!comparison.comparable?<p>Stavy nelze spolehlivě porovnat (offline, opačné pořadí nebo odstup delší než 15 minut).</p>
        : comparison.changes.length ? <ul>
          {comparison.changes.map(change=><li key={change.label}>
            <strong>{change.label}</strong>:
            {' '}{String(change.before)} → {String(change.after)} {change.unit}
            {change.delta!==null?<> (rozdíl {change.delta>0?'+':''}{change.delta} {change.unit})</>:null}
          </li>)}
        </ul> : <p>Ve vybraných čerstvých údajích nebyla zaznamenána změna.
          Nemusí to znamenat, že ovladač nefunguje.</p>}
      <p>Číselné změny jsou pouze pozorování telemetrie. Ruční potvrzení účinku v kokpitu zůstává nutné.</p>
    </section>}
    {evidence?.aircraft===aircraft&&<p>
      Technický snapshot: {evidence.snapshot.capturedAtUtc}
      {' · '}SimConnect {evidence.snapshot.telemetry.live?'připojen':'neověřen'}
      {' · '}systémy {evidence.snapshot.systems.available?'dostupné':'nedostupné'}
      {' · '}navigace {evidence.snapshot.navigation.available?'dostupná':'nedostupná'}.
    </p>}
    <p>Technický snímek čte pouze existující read-only API na vyžádání, ukládá jen povolené
      diagnostické položky, bez GPS souřadnic, historie poloh či tajných údajů.
      Ručně psané poznámky ale mohou obsahovat osobní údaje — před sdílením je zkontrolujte.</p>
  </section>;
}