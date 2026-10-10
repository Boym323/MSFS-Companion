import {useEffect,useState} from 'react';
import {freshMcduGps,mcduMinutes,mcduValue,mcduWaypointName,
 type McduPage,type McduStatus,type McduGps} from './mcduModel';
import './A320McduPanel.css';
import A320SectionHeader from './A320SectionHeader';

type Reading={payload:McduStatus;receivedAt:number};
const pages:readonly McduPage[]=['F-PLN','PROG','STATUS'];
const disabledKeys=['DIR','RAD NAV','INIT','PERF','DATA','FUEL PRED','SEC F-PLN','ATC COMM',
 'A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T',
 'U','V','W','X','Y','Z','0','1','2','3','4','5','6','7','8','9','CLR','/', '.', 'SP', 'OVFY'];
const statusLine=(yes:boolean)=>yes?'OVĚŘENO':'NEDOSTUPNÉ';

function GreenLine({name,value,secondary}:{
 name:string;value:string;secondary?:string
}){
 return <div className="a320-mcdu-cdu-line">
  <span>{name}</span><strong>{value}</strong>
  {secondary&&<small>{secondary}</small>}
 </div>;
}
function Display({page,gps,status}:{page:McduPage;gps:McduGps|null;status:McduStatus|null}){
 const active=!!gps?.flightPlanActive;
 return <div className="a320-mcdu-display" aria-label="MCDU Companion – GPS diagnostika">
  <div className="a320-mcdu-display-top">
   <span>GPS DATA <em>· NE MCDU</em></span><strong>{page}</strong><span>WEB</span>
  </div>
  {page==='F-PLN'&&<>
   <div className="a320-mcdu-column-headers"><span>GPS PLAN</span><span>LEG</span></div>
   <GreenLine name="FLIGHT PLAN" value={!gps?'---':active?'ACTIVE':'INACTIVE'}
    secondary="GENERIC SIMCONNECT"/>
   <GreenLine name="NEXT WAYPOINT" value={mcduWaypointName(gps)}
    secondary="NELZE ZÍSKAT CELÝ LETOVÝ PLÁN MCDU"/>
   <GreenLine name="WAYPOINT INDEX"
    value={!active?'---':gps?.waypointCount?
     String(gps.waypointIndex+1)+'/'+gps.waypointCount:'---'}/>
   <GreenLine name="DISTANCE" value={active?mcduValue(gps?.distanceNauticalMiles,1,' NM'):'---'}/>
   <GreenLine name="ETE" value={active?mcduMinutes(gps?.eteSeconds):'---'}/>
   <p className="a320-mcdu-screen-note">ŽÁDNÁ NEOVĚŘENÁ SID/STAR ANI DALŠÍ BODY TRASY</p>
  </>}
  {page==='PROG'&&<>
   <GreenLine name="GPS DESIRED TRACK" value={active?mcduValue(gps?.desiredTrackDegrees,0,'°'):'---'}/>
   <GreenLine name="GROUND TRACK" value={mcduValue(gps?.groundTrackDegrees,0,'°')}/>
   <GreenLine name="CROSS TRACK" value={active?mcduValue(gps?.crossTrackNauticalMiles,2,' NM'):'---'}/>
   <GreenLine name="TOTAL FLIGHT PLAN" value={mcduValue(gps?.totalFlightPlanNauticalMiles,1,' NM')}/>
   <GreenLine name="NEXT WAYPOINT" value={mcduWaypointName(gps)}/>
   <p className="a320-mcdu-screen-note">ÚDAJE GPS · NIKOLI AIRBUS FMS PROGRESS</p>
  </>}
  {page==='STATUS'&&<>
   <GreenLine name="MCDU SCREEN" value={statusLine(status?.mcduScreenAvailable===true)}/>
   <GreenLine name="MCDU KEYS" value={statusLine(status?.mcduKeysAvailable===true)}/>
   <GreenLine name="MCDU FMS PLAN" value={statusLine(status?.mcduFlightPlanVerified===true)}/>
   <GreenLine name="GENERIC GPS" value={gps?'CONNECTED':'UNAVAILABLE'}/>
   <GreenLine name="AUTHORIZED COMMANDS" value={String(status?.keyActions?.length??0)}/>
   <p className="a320-mcdu-screen-note">MCDU KLÁVESY V SIMULÁTORU ZŮSTÁVAJÍ ZAMČENÉ</p>
  </>}
  <div className="a320-mcdu-scratchpad" aria-label="MCDU scratchpad nedostupný">MCDU SCRATCHPAD NOT AVAILABLE</div>
 </div>;
}

export default function A320McduPanel({live,aircraft,identified}:{
 live:boolean;aircraft:string;identified:boolean
}){
 const [page,setPage]=useState<McduPage>('F-PLN');
 const [reading,setReading]=useState<Reading|null>(null);
 const [clock,setClock]=useState(()=>Date.now());
 const [error,setError]=useState(false);
 useEffect(()=>{setPage('F-PLN');setReading(null);setError(false);},[live,aircraft,identified]);
 useEffect(()=>{
  const ticker=window.setInterval(()=>setClock(Date.now()),1000);
  return()=>window.clearInterval(ticker);
 },[]);
 useEffect(()=>{
  if(!live||!aircraft||!identified){setReading(null);return;}
  let stopped=false,inflight=false;
  const controller=new AbortController();
  const refresh=async()=>{
   if(stopped||inflight)return;
   inflight=true;
   try{
    const response=await fetch('/api/a320/mcdu/status',{
     cache:'no-store',signal:controller.signal
    });
    if(!response.ok)throw Error('MCDU capability readback unavailable');
    const payload=await response.json() as McduStatus;
    if(!stopped){
     setReading(payload.connected&&payload.aircraft===aircraft?
      {payload,receivedAt:Date.now()}:null);
     setError(false);
    }
   }catch{
    if(!stopped){setReading(null);setError(true);}
   }finally{inflight=false;}
  };
  void refresh();
  const timer=window.setInterval(()=>void refresh(),1900);
  return()=>{stopped=true;controller.abort();window.clearInterval(timer);};
 },[live,aircraft,identified]);

 const status=identified&&reading?.payload.aircraft===aircraft?reading?.payload??null:null;
 const gps=freshMcduGps(status,aircraft,live,
  reading?Math.max(0,clock-reading.receivedAt):Infinity);
 const detail=error?'MCDU API je dočasně nedostupné':
  !identified?'Čekám na ověřenou identitu původního Asobo A320neo':
  !gps?'GPS data nejsou dostupná nebo jsou zastaralá':
  'Aktivní GPS data · skutečný MCDU ještě není integrován';
 return <section className="a320-mcdu-section" aria-label="Airbus A320 MCDU companion">
  <A320SectionHeader title="MCDU Companion" eyebrow="LETOVÝ PLÁN"
   status={detail}/>
  <div className="a320-mcdu-layout">
   <div className="a320-mcdu-unit">
    <div className="a320-mcdu-lsk" aria-hidden="true">
     {Array.from({length:6},(_,i)=><span key={i} className="a320-mcdu-lsk-stub"/>)}
    </div>
    <Display page={page} gps={gps} status={status}/>
    <div className="a320-mcdu-lsk" aria-hidden="true">
     {Array.from({length:6},(_,i)=><span key={i} className="a320-mcdu-lsk-stub"/>)}
    </div>
   </div>
   <div className="a320-mcdu-console">
    <h4>STRÁNKY KOKPITU <small>lokální náhled · neovládá MCDU</small></h4>
    <div className="a320-mcdu-pages">
     {pages.map(p=><button key={p} type="button"
      className={page===p?'is-selected':''} aria-pressed={page===p}
      onClick={()=>setPage(p)}>{p}</button>)}
    </div>
    <h4>KLÁVESY MCDU <small>nedostupné bez ověřeného mapování</small></h4>
    <div className="a320-mcdu-keypad">
     {disabledKeys.map(key=><button key={key} type="button"
      title={'MCDU '+key+' není zatím spojeno se simulátorem'}
      aria-label={'MCDU '+key+' – neověřená klávesa, vypnuto'}
      disabled>{key}</button>)}
    </div>
   </div>
  </div>
  <p className="a320-mcdu-warning">
   Toto není obraz displeje Airbus MCDU. Kokpit zobrazuje pouze čerstvý,
   ověřitelně dostupný <strong>aktivní GPS úsek</strong> ze SimConnectu.
   Originální MCDU obrazovka, výpočty FMS a vzdálené klávesy nejsou
   integrovány a nemohou provést žádný příkaz.
   Žádná další aplikace ve Windows není potřeba.
  </p>
 </section>;
}
