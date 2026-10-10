import {useEffect,useState} from 'react';
import {aircraftSystemLabel,cockpitSystemsFresh,latestValue,systemNumber,
 type CockpitSystemsResponse,type CockpitSystemFlags} from './systemsReadback';
import './A320SystemsPanel.css';

type EngineData={timestampUtc:string;n1Engine1:number;n1Engine2:number;
 n2Engine1:number;n2Engine2:number;fuelFlowPph1:number;fuelFlowPph2:number};
type AuxData={timestampUtc:string;apuRpmPercent:number;apuGeneratorActive:boolean;
 fuelTotalWeightPounds:number};
type ModeData={timestampUtc:string;flightDirector:boolean;autoThrottleArmed:boolean;
 managedThrottleActive:boolean;approachArmed:boolean;approachActive:boolean;
 glideSlopeActive:boolean;headingLock:boolean;navLock:boolean};

function Flag({name,reading,available,source='SimVar'}:{
 name:string;reading:boolean|null|undefined;available:boolean;source?:string
}){
 const state=available?aircraftSystemLabel(reading):'—';
 return <div className={'a320-sys-flag'+(available?' is-sampled':'')+
  (available&&reading===true?' is-active':'')}>
  <div className="a320-sys-flag-label">{name}</div>
  <div className="a320-sys-flag-lens" aria-label={name+': '+state}>{state}</div>
  <span className="a320-sys-flag-caption">{source}</span>
 </div>;
}

function Value({name,value,unit='',warning}:{name:string;
 value:number|null|undefined;unit?:string;warning?:string}){
 return <div className="a320-sys-value">
  <dt>{name}</dt><dd>{systemNumber(value,unit==='%'?1:0)}
   {value!==null&&value!==undefined&&Number.isFinite(value)&&unit&&<small> {unit}</small>}</dd>
  {warning&&<span className="a320-sys-secondary">{warning}</span>}
 </div>;
}

export default function A320SystemsPanel({live,aircraft,identified,view='both',
 engines,enginesAgeMs,aux,auxAgeMs,modes,modesAgeMs}:{
 live:boolean;aircraft:string;identified:boolean;
 view?:'overhead'|'ecam'|'both';
 engines:EngineData|null;enginesAgeMs:number|null;
 aux:AuxData|null;auxAgeMs:number|null;
 modes:ModeData|null;modesAgeMs:number|null
}){
 const [reading,setReading]=useState<{aircraft:string;data:CockpitSystemsResponse}|null>(null);
 const [connectionError,setConnectionError]=useState(false);
 useEffect(()=>{
  setReading(null);setConnectionError(false);
  if(!live||!aircraft||!identified)return;
  let stopped=false,inFlight=false;
  const controller=new AbortController();
  const poll=async()=>{
   if(stopped||inFlight)return;
   inFlight=true;
   try{
    const r=await fetch('/api/cockpit/systems',
      {cache:'no-store',signal:controller.signal});
    if(!r.ok)throw Error('readback-unavailable');
    const response=await r.json() as CockpitSystemsResponse;
    if(!stopped){setReading({aircraft,data:response});setConnectionError(false);}
   }catch{
    if(!stopped){setReading(null);setConnectionError(true);}
   }finally{inFlight=false;}
  };
  void poll();
  const interval=window.setInterval(()=>void poll(),2000);
  return()=>{stopped=true;controller.abort();window.clearInterval(interval);};
 },[aircraft,identified,live]);

 const trusted=identified&&live&&!!aircraft;
 const generic=cockpitSystemsFresh(reading?.data??null,
  reading?.aircraft??null,aircraft,trusted)?reading!.data.systems:null;
 const validEngines=trusted?latestValue(engines,enginesAgeMs):null;
 const validAux=trusted?latestValue(aux,auxAgeMs):null;
 const validModes=trusted?latestValue(modes,modesAgeMs):null;
 const flags:ReadonlyArray<{label:string;key:Exclude<keyof CockpitSystemFlags,'timestampUtc'>}>=[
  {label:'LAND',key:'landing'}, {label:'TAXI',key:'taxi'},
  {label:'NAV',key:'nav'},{label:'BEACON',key:'beacon'},
  {label:'STROBE',key:'strobe'}, {label:'PITOT HEAT',key:'pitot'}
 ];
 return <section className="a320-sys-root" aria-label="Airbus Overhead a ECAM referenční systémový přehled">
  <div className="a320-sys-heading">
   <div><span>ŽIVÁ DATA · SIMCONNECT</span><h3>{view==='overhead'?'Overhead · systémový přehled':
     view==='ecam'?'ECAM · motory a palivo':'Overhead a ECAM'}</h3></div>
   <span role="status" className={trusted?'is-online':'a320-sys-muted'}>
    {trusted?'A320 identita rozpoznána':'A320 není rozpoznán'}
   </span>
  </div>
  <div className={'a320-sys-columns'+(view==='both'?'':' a320-sys-columns--single')}>
   {view!=='ecam'&&<section className="a320-sys-overhead">
    <header><span>OVERHEAD</span><strong>LIGHTS / AIR DATA</strong></header>
    <div className="a320-sys-flag-grid">
     {flags.map(f=><Flag key={f.key} name={f.label}
      reading={generic?.[f.key]} available={generic!==null}/>)}
    </div>
    <div className="a320-sys-overhead-bottom">
     <div className="a320-sys-status-pair">
      <span>PARK BRK · GROUND</span>
      <strong>{generic?aircraftSystemLabel(generic.parkingBrake):'—'}</strong>
     </div>
     <div className="a320-sys-status-pair">
      <span>APU GEN · GENERIC</span>
      <strong>{validAux?aircraftSystemLabel(validAux.apuGeneratorActive):'—'}</strong>
     </div>
    </div>
    <p className="a320-sys-note">Zobrazuje se aktuální stav obecných světel,
     pitot heat a parkovací brzdy ze SimConnectu. Nejde o potvrzení
     polohy fyzických Airbus overhead přepínačů. Přepínače zde neposílají příkazy.</p>
   </section>}
   {view!=='overhead'&&<section className="a320-sys-ecam">
    <header><span>ECAM DATA</span><strong>ENGINE / APU / FUEL</strong></header>
    <div className="a320-sys-engine-pair">
     {[1,2].map(index=><div className="a320-sys-engine" key={index}>
      <h4>ENG {index}</h4>
      <dl>
       <Value name="N1" value={validEngines?(index===1?
        validEngines.n1Engine1:validEngines.n1Engine2):null} unit="%"/>
       <Value name="N2" value={validEngines?(index===1?
        validEngines.n2Engine1:validEngines.n2Engine2):null} unit="%"/>
       <Value name="FUEL FLOW" value={validEngines?(index===1?
        validEngines.fuelFlowPph1:validEngines.fuelFlowPph2):null} unit="lb/h"/>
      </dl>
     </div>)}
    </div>
    <div className="a320-sys-ecam-bottom">
     <dl><Value name="APU" value={validAux?.apuRpmPercent} unit="%"/>
      <Value name="FUEL ON BOARD" value={validAux?.fuelTotalWeightPounds}
       unit="lb"/></dl>
     <div className="a320-sys-mode-flags">
      <Flag name="FLIGHT DIRECTOR" reading={validModes?.flightDirector}
       available={validModes!==null}/>
      <Flag name="A/THR ARM" reading={validModes?.autoThrottleArmed}
       available={validModes!==null}/>
     </div>
    </div>
    <p className="a320-sys-note">Referenční údaje ze standardních SimVars,
     nikoli originální obrazovka ECAM nebo Airbus FMA.
     Chybějící či zastaralá data nejsou zobrazována jako nula nebo OFF.</p>
   </section>}
  </div>
  {connectionError&&trusted&&<p className="a320-sys-warning" role="status">
   Čtení světel/overhead systémů není dostupné. Ostatní údaje zůstávají nezávislé.</p>}
  <p className="a320-sys-footer">Živá data vyžadují rozpoznaný původní Asobo A320neo V1.
   Pro ovládání světel, APU a systémů Airbusu je potřeba nejdříve ověřit
   odpovídající H-Events a stav fyzických přepínačů v MSFS 2020.</p>
 </section>;
}
