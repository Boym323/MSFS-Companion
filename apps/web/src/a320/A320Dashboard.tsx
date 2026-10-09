import {useEffect,useState} from 'react';
import type {TelemetrySnapshot} from '../telemetry/types';
import {useFlightNavigation,FlightNavigationPanel} from '../map/FlightNavigation';
import './A320Dashboard.css';

type Engines={
 timestampUtc:string;n1Engine1:number;n1Engine2:number;n2Engine1:number;n2Engine2:number;
 fuelFlowPph1:number;fuelFlowPph2:number
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
 engines:Engines|null;fcu:Fcu|null;enginesAgeMs:number|null;fcuAgeMs:number|null;warning:string
};

const fmt=(value:number|undefined,digits=0)=>
  value!==undefined&&Number.isFinite(value)?value.toFixed(digits):'—';

export default function A320Dashboard({telemetry,live}:{
 telemetry:TelemetrySnapshot|null;live:boolean
}){
 const [status,setStatus]=useState<Readback|null>(null);
 const [error,setError]=useState('');
 const navigation=useFlightNavigation(live);
 const aircraft=telemetry?.aircraft??'';
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

 const e=status?.engines??null,f=status?.fcu??null;
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
   </article>
  </div>
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
