import {useEffect,useState} from 'react';
import type {TelemetrySnapshot} from '../telemetry/types';
import {useFlightNavigation,FlightNavigationPanel} from '../map/FlightNavigation';
import {compareA320FcuEvidence,type FcuEvidence} from './fcuEvidence';
import A320FcuControlPanel from './A320FcuControlPanel';
import './A320Dashboard.css';

type Engines={
 timestampUtc:string;n1Engine1:number;n1Engine2:number;n2Engine1:number;n2Engine2:number;
 fuelFlowPph1:number;fuelFlowPph2:number
};
type Aux={
 timestampUtc:string;apuRpmPercent:number;apuGeneratorActive:boolean;
 fuelTotalWeightPounds:number
};
type Modes={
 timestampUtc:string;flightDirector:boolean;autoThrottleArmed:boolean;
 managedThrottleActive:boolean;approachArmed:boolean;approachActive:boolean;
 glideSlopeActive:boolean;headingLock:boolean;navLock:boolean
};
type Fcu={
 timestampUtc:string;selectedSpeedKnots:number;selectedMach:number;
 selectedHeadingDegrees:number;selectedAltitudeFeet:number;selectedVerticalSpeedFpm:number;
 speedSlotIndex:number;headingSlotIndex:number;altitudeSlotIndex:number;
 verticalSpeedSlotIndex:number;autopilotMaster:boolean;verification:string
};
type Readback={
 connected:boolean;aircraft:string|null;profileId:string;
 verifiedAircraft:boolean;mode:string;fmaVerified:boolean;
 engines:Engines|null;fcu:Fcu|null;aux:Aux|null;modes:Modes|null;
 enginesAgeMs:number|null;fcuAgeMs:number|null;auxAgeMs:number|null;
 modesAgeMs:number|null;warning:string
};

const fmt=(value:number|undefined,digits=0)=>
  value!==undefined&&Number.isFinite(value)?value.toFixed(digits):'—';

export default function A320Dashboard({telemetry,live}:{
 telemetry:TelemetrySnapshot|null;live:boolean
}){
 const [status,setStatus]=useState<Readback|null>(null);
 const [error,setError]=useState('');
 const [baseline,setBaseline]=useState<FcuEvidence|null>(null);
 const [after,setAfter]=useState<FcuEvidence|null>(null);
 const navigation=useFlightNavigation(live);
 const aircraft=telemetry?.aircraft??'';
 useEffect(()=>{setBaseline(null);setAfter(null);},[aircraft,live]);
 useEffect(()=>{
   if(!live||!aircraft){setStatus(null);return;}
   let closed=false,inFlight=false;
   const controller=new AbortController();
   async function poll(){
     if(inFlight||closed)return;inFlight=true;
     try{
       const result=await fetch('/api/aircraft/airbus/a320/status',
         {cache:'no-store',signal:controller.signal});
       if(!result.ok)throw Error('Diagnostika A320 není dostupná');
       const next=await result.json() as Readback;
       if(!closed){
         // The server must report the exact live TITLE. Never reuse values
         // from a different aircraft or simulator generation.
         setStatus(next.connected&&next.aircraft===aircraft?next:null);
         setError('');
       }
     }catch{
       if(!closed){setStatus(null);setError('A320 readback není dostupný.');}
     }finally{inFlight=false;}
   }
   setStatus(null);void poll();
   const timer=window.setInterval(()=>void poll(),1600);
   return()=>{closed=true;controller.abort();window.clearInterval(timer);};
 },[aircraft,live]);

 const e=status?.engines??null,f=status?.fcu??null,aux=status?.aux??null,
   modes=status?.modes??null;
 const canCapture=!!status?.connected&&!!status.aircraft&&!!f
   &&status.fcuAgeMs!==null&&status.fcuAgeMs<3000;
 function capture(asBaseline:boolean){
   if(!canCapture||!status?.aircraft||!f)return;
   const point:FcuEvidence={aircraft:status.aircraft,
     capturedAtUtc:new Date().toISOString(),fcu:f};
   if(asBaseline){setBaseline(point);setAfter(null);}
   else setAfter(point);
 }
 const evidence=baseline&&after?compareA320FcuEvidence(baseline,after):null;
 function exportEvidence(){
   if(!baseline||!after||!evidence)return;
   const sanitized={schema:'kokpit-a320-fcu-evidence-v1',
     note:'Pozorování obecných SimVars, nikoli potvrzení FCU aktuátoru.',
     before:baseline,after,comparison:evidence};
   const url=URL.createObjectURL(new Blob([JSON.stringify(sanitized,null,2)],
     {type:'application/json'}));
   const link=document.createElement('a');
   link.href=url;link.download='kokpit-asobo-a320-fcu-evidence.json';
   document.body.append(link);link.click();link.remove();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);
 }

 return <section className="a320-dashboard" aria-label="Diagnostika Airbus A320neo">
  <div className="a320-heading">
   <div>
    <p className="a320-eyebrow">A320-04 · ASOBO A320NEO</p>
    <h2>Airbus flight deck</h2>
    <p>Oddělená čtecí diagnostika Airbusu. Kokpit neodesílá žádné
       neověřené příkazy FCU/MCDU.</p>
   </div>
   <span className="a320-status" role="status">
    {status?'Čtecí zdroj aktivní · neověřeno na A320':
      live?'Čekám na identitu a diagnostiku A320':'MSFS offline'}
   </span>
  </div>
  {error&&<p className="a320-alert" role="status">{error}</p>}
  {!status&&live&&<p className="a320-alert">Zobrazí se pouze rozpoznaný kandidát
    původního Asobo A320neo. Žádné údaje nepřebírám z jiných letadel.</p>}
  <div className="a320-sections">
   <article className="a320-section">
    <h3>FCU · reference ze SimConnectu</h3>
    <p className="a320-hint">Hodnoty nejsou potvrzením displeje FCU ani
      režimů FMA. Indexy jsou surové SimVars, nikoliv ověřený
      stav managed/selected.</p>
    <dl className="a320-grid a320-fcu">
     <div><dt>SPD</dt><dd>{fmt(f?.selectedSpeedKnots)} <small>KT</small></dd></div>
     <div><dt>MACH</dt><dd>{fmt(f?.selectedMach,2)}</dd></div>
     <div><dt>HDG</dt><dd>{fmt(f?.selectedHeadingDegrees)} <small>°</small></dd></div>
     <div><dt>ALT</dt><dd>{fmt(f?.selectedAltitudeFeet)} <small>FT</small></dd></div>
     <div><dt>V/S</dt><dd>{fmt(f?.selectedVerticalSpeedFpm)} <small>FPM</small></dd></div>
     <div><dt>AP MASTER</dt><dd>{f?(f.autopilotMaster?'ON':'OFF'):'—'}</dd></div>
    </dl>
    <p className="a320-hint">Raw sloty · SPD {f?.speedSlotIndex??'—'}
      {' · '}HDG {f?.headingSlotIndex??'—'}
      {' · '}ALT {f?.altitudeSlotIndex??'—'}
      {' · '}VS {f?.verticalSpeedSlotIndex??'—'}</p>
    <p className="a320-hint">FMA/AP1/AP2/FD/A-THR:
      <strong> neověřeno</strong> – bez domýšlení režimů.</p>
   </article>
   <article className="a320-section">
    <h3>Motory · ENG 1 / ENG 2</h3>
    <p className="a320-hint">Obecné turbínové SimVars; správnost potvrďte
      proti ECAM v původním MSFS 2020.</p>
    <div className="a320-engines">
     {([1,2] as const).map(index=><div key={index}>
       <h4>ENG {index}</h4>
       <dl className="a320-engine-metrics">
        <div><dt>N1</dt><dd>{fmt(index===1?e?.n1Engine1:e?.n1Engine2,1)} <small>%</small></dd></div>
        <div><dt>N2</dt><dd>{fmt(index===1?e?.n2Engine1:e?.n2Engine2,1)} <small>%</small></dd></div>
        <div><dt>Fuel flow</dt><dd>{fmt(index===1?e?.fuelFlowPph1:e?.fuelFlowPph2)} <small>lb/h</small></dd></div>
       </dl>
     </div>)}
    </div>
    <div className="a320-aux">
      <h4>APU &amp; FOB · orientační</h4>
      <p>APU RPM: <strong>{fmt(aux?.apuRpmPercent,1)} %</strong>
        {' · '}APU GEN: <strong>{aux?(aux.apuGeneratorActive?'ON':'OFF'):'—'}</strong></p>
      <p>Fuel on board: <strong>{fmt(aux?.fuelTotalWeightPounds)} lb</strong></p>
      <p className="a320-hint">Zobrazené jednotky a stavy pocházejí z
        obecných SimVars, nejsou potvrzený obsah ECAM.</p>
    </div>
   </article>
  </div>
  <section className="a320-section a320-modes">
    <h3>Autopilot · doplňkový readback</h3>
    <p className="a320-hint">Osm obecných SimConnect stavů, nezávislý 1Hz čteč.
      Nejde o Airbus FMA, zvlášť potvrzený AP1/AP2 ani závazný stav managed/selected.</p>
    <div className="a320-mode-list">
      {([
        ['Flight Director',modes?.flightDirector],
        ['A/THR ARM',modes?.autoThrottleArmed],
        ['Managed thrust',modes?.managedThrottleActive],
        ['APPR armed',modes?.approachArmed],
        ['APPR active',modes?.approachActive],
        ['G/S active',modes?.glideSlopeActive],
        ['Heading lock',modes?.headingLock],
        ['NAV lock',modes?.navLock]
      ] as const).map(([label,value])=><div key={label}>
        <span>{label}</span>
        <strong>{value===undefined?'—':value?'ON':'OFF'}</strong>
      </div>)}
    </div>
  </section>
  <section className="a320-section a320-proof">
   <h3>A320-07 · Ruční validace FCU</h3>
   <p className="a320-hint">Nejprve zachyťte FCU, pak změňte skutečný knob
    Asobo A320neo přímo v MSFS a zachyťte další stav. Kokpit
    zde žádný povel do simulátoru neposílá.</p>
   <div className="a320-proof-actions">
    <button type="button" disabled={!canCapture}
      onClick={()=>capture(true)}>Výchozí FCU</button>
    <button type="button" disabled={!canCapture||!baseline}
      onClick={()=>capture(false)}>Po změně</button>
    <button type="button" disabled={!evidence}
      onClick={exportEvidence}>Export JSON</button>
   </div>
   <p className="a320-hint" role="status">
    {!baseline?'Výchozí měření chybí.':
     !after?'Výchozí stav zachycen. Změňte FCU přímo v MSFS.':
     evidence?.reason}
   </p>
   {evidence?.changes.length?<ul className="a320-proof-changes">
     {evidence.changes.map((change,i)=><li key={i}>{change}</li>)}
   </ul>:null}
   <p className="a320-hint">Změna obecné SimVar neprokazuje funkčnost
    dálkového ovládání. Pro pilotní PASS porovnejte displej FCU/FMA.
    Export neobsahuje GPS stopu ani přístupové tokeny.</p>
  </section>
  <A320FcuControlPanel live={live} aircraft={aircraft} />
  <section className="a320-section a320-nav">
   <FlightNavigationPanel navigation={status?navigation:null}/>
   <p className="a320-hint">Zobrazení je pouze read-only GPS readback, nikoli
      úplný obsah MCDU, SID/STAR či správně potvrzený aktivní leg.
      <a href="/map"> Otevřít mapu</a>.</p>
  </section>
  <p className="a320-footer">Typ: {status?.aircraft??'—'} ·
    FCU {f?Math.round(status?.fcuAgeMs??0)+' ms':'nedostupné'} ·
    ENG {e?Math.round(status?.enginesAgeMs??0)+' ms':'nedostupné'}.
    Nedostupné hodnoty jsou „—“, ne falešná nula.</p>
 </section>;
}
