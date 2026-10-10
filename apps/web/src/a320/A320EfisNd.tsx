import {useEffect,useState} from 'react';
import type {TelemetrySnapshot} from '../telemetry/types';
import type {Navigation} from '../map/FlightNavigation';
import {headingLabel,ND_RANGES,validSample,waypointOnNd,type NdRange,type NdMode} from './ndLocalModel';
import './A320EfisNd.css';
import A320SectionHeader from './A320SectionHeader';

const format=(value:number|null|undefined,decimals=0)=>value===null||
 value===undefined||!Number.isFinite(value)?'—':value.toFixed(decimals);

function NdDisplay({telemetry,navigation,valid,mode,range}:{
 telemetry:TelemetrySnapshot|null;navigation:Navigation|null;
 valid:boolean;mode:NdMode;range:NdRange
}){
 const own=valid&&telemetry?{latitude:telemetry.latitude,longitude:telemetry.longitude}:null;
 const next=valid&&navigation?.flightPlanActive&&navigation.waypointActive?
  navigation.nextWaypoint:null;
 const bearing=waypointOnNd(own,next,telemetry?.headingDegrees??NaN,
  range,mode,navigation?.nextWaypointId??null);
 const heading=valid?telemetry?.headingDegrees:null;
 const originY=mode==='ARC'?394:231;
 const rings=mode==='ARC'?[90,180,270]:[60,118,175];
 const headingTicks=Array.from({length:36},(_,i)=>i*10);
 return <div className="a320-nd-view">
  <svg viewBox="0 0 600 460" role="img"
   aria-label={'Navigační displej webu, mód '+mode+', dosah '+range+' NM'}>
   <rect width="600" height="460" rx="9" className="a320-nd-background"/>
   <defs><clipPath id="a320-nd-clip"><rect x="16" y="44" width="568" height="402" rx="6"/></clipPath></defs>
   <g clipPath="url(#a320-nd-clip)">
    {rings.map((r,index)=><g key={r}>
     <circle cx="300" cy={originY} r={r} className="a320-nd-range-ring"/>
     <text x={300+r*.70} y={originY-r*.70-7} className="a320-nd-range-label">
      {format((index+1)*range/3,0)}
     </text>
    </g>)}
    {headingTicks.map(degrees=>{
     const relative=(degrees-(heading??0))*Math.PI/180;
     const outer=mode==='ARC'?293:198;
     const inner=degrees%30===0?outer-19:outer-10;
     const to=(r:number)=>({x:300+Math.sin(relative)*r,y:originY-Math.cos(relative)*r});
     const a=to(outer),b=to(inner),t=to(outer+18);
     return <g key={degrees}>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="a320-nd-hdg-tick"/>
      {degrees%30===0&&<text x={t.x} y={t.y} textAnchor="middle"
       dominantBaseline="middle" className="a320-nd-hdg-text">{String(degrees/10).padStart(2,'0')}</text>}
     </g>;
    })}
    {bearing?.withinRange&&<>
      <line x1="300" y1={originY} x2={bearing.x} y2={bearing.y}
       className="a320-nd-bearing-line"/>
      <path d={`M ${bearing.x} ${bearing.y-11} l 11 11 -11 11 -11 -11 Z`}
       className="a320-nd-waypoint-symbol"/>
      <text x={Math.min(548,Math.max(48,bearing.x+17))} y={bearing.y-13}
       className="a320-nd-waypoint-label">{bearing.id??'GPS WP'}</text>
    </>}
   </g>
   <path d="M 300 72 l -10 19 h 20 Z" className="a320-nd-aircraft-pointer"/>
   {mode==='ARC'?<path d="M 300 369 l -12 35 12 -9 12 9 Z" className="a320-nd-aircraft"/>
    :<path d="M 300 209 l -12 34 12 -9 12 9 Z" className="a320-nd-aircraft"/>}
   <rect x="253" y="4" width="94" height="37" rx="5" className="a320-nd-heading-box"/>
   <text x="300" y="29" textAnchor="middle" className="a320-nd-heading-number">
    {headingLabel(heading)}
   </text>
   <text x="20" y="29" className="a320-nd-flag">ND · WEB</text>
   <text x="579" y="29" textAnchor="end" className="a320-nd-flag">{mode} · {range} NM</text>
   {!valid&&<text x="300" y="233" textAnchor="middle" className="a320-nd-unavailable">
    ČEKÁM NA ŽIVÁ DATA A320
   </text>}
   {valid&&!bearing&&<text x="300" y="233" textAnchor="middle" className="a320-nd-unavailable">
    AKTIVNÍ GPS WAYPOINT NENÍ K DISPOZICI
   </text>}
   {valid&&bearing&&!bearing.withinRange&&<text x="300" y="233" textAnchor="middle"
    className="a320-nd-unavailable">
    WAYPOINT MIMO ZVOLENÝ DOSAH
   </text>}
  </svg>
  <div className="a320-nd-footer">
   <span>TRK {format(valid?navigation?.groundTrackDegrees:null)}°</span>
   <span>WP {valid&&bearing?(bearing.id??'GPS'):'—'}</span>
   <span>DIST {valid&&bearing?format(bearing.distanceNm,1)+' NM':'—'}</span>
  </div>
 </div>;
}

function Unmapped({name}:{name:string}){
 return <button type="button" className="a320-efis-flag-button" disabled
  title={name+' — bez ověřeného Airbus readbacku a příkazu'}
  aria-label={name+' – neověřené, vypnuto'}>{name}</button>;
}

export default function A320EfisNd({telemetry,navigation,live,identified}:{
 telemetry:TelemetrySnapshot|null;navigation:Navigation|null;live:boolean;identified:boolean
}){
 const [mode,setMode]=useState<NdMode>('ARC');
 const [range,setRange]=useState<NdRange>(40);
 const [clock,setClock]=useState(()=>Date.now());
 const aircraft=telemetry?.aircraft??'';
 useEffect(()=>{setMode('ARC');setRange(40);},[aircraft,live]);
 useEffect(()=>{
  const timer=window.setInterval(()=>setClock(Date.now()),1000);
  return()=>window.clearInterval(timer);
 },[]);
 // No aircraft identity -> no GPS overlay from another aircraft.
 const valid=live&&identified&&!!telemetry&&validSample(telemetry.timestampUtc,clock);
 return <section className="a320-efis-nd" aria-label="A320 EFIS a lokální navigační displej">
  <A320SectionHeader title="EFIS · navigační displej"
   eyebrow="NAVIGACE" status="GPS / SimConnect · režimy pouze ve webovém náhledu" />
  <div className="a320-efis-layout">
   <div className="a320-efis-controls">
    <div className="a320-efis-control-section">
     <h4>MODE <small>pouze lokální zobrazení Kokpitu</small></h4>
     <div className="a320-efis-toggle-row">
      <button type="button" className={mode==='ROSE NAV'?'selected':''}
       aria-pressed={mode==='ROSE NAV'} onClick={()=>setMode('ROSE NAV')}>ROSE NAV</button>
      <button type="button" className={mode==='ARC'?'selected':''}
       aria-pressed={mode==='ARC'} onClick={()=>setMode('ARC')}>ARC</button>
      {['ILS','VOR','PLAN'].map(name=><Unmapped key={name} name={name}/>)}
     </div>
    </div>
    <div className="a320-efis-control-section">
     <h4>RANGE <small>dosah náhledu ND · NM</small></h4>
     <div className="a320-efis-range-row">
      {ND_RANGES.map(value=><button type="button" key={value}
       className={range===value?'selected':''} aria-pressed={range===value}
       onClick={()=>setRange(value)}>{value}</button>)}
     </div>
    </div>
    <div className="a320-efis-control-section">
     <h4>MAP DATA</h4>
     <div className="a320-efis-overlays">
      {['CSTR','WPT','VOR.D','NDB','ARPT','LS','FD'].map(name=>
       <Unmapped key={name} name={name}/>)}
     </div>
     <p>Airbus EFIS přepínače nemají ověřený readback ani H-event mapování.
      Tyto prvky nelze ovládat v simulátoru.</p>
    </div>
    <div className="a320-efis-data-list">
     <div><span>LETADLO</span><strong>{identified?aircraft:'NEOVĚŘENO'}</strong></div>
     <div><span>HDG (telemetrie)</span><strong>{valid?headingLabel(telemetry?.headingDegrees):'—'}</strong></div>
     <div><span>GPS PLAN</span><strong>{valid&&navigation?
      navigation.flightPlanActive?'AKTIVNÍ':'NEAKTIVNÍ':'—'}</strong></div>
     <div><span>AKTIVNÍ LEG</span><strong>{valid&&navigation?.waypointActive?
      (navigation.nextWaypointId??'GPS WP'):'—'}</strong></div>
    </div>
   </div>
   <NdDisplay telemetry={telemetry} navigation={valid?navigation:null}
    valid={valid} range={range} mode={mode}/>
  </div>
  <p className="a320-efis-disclaimer">ND je originální webová vizualizace aktivního
   GPS waypointu a polohy letadla; není to kopie displeje Airbus ND ani avioniky FMS.
   Volby MODE/RANGE mění jen tento webový náhled, neposílají žádné příkazy do MSFS.
   Nezobrazuje kompletní trasu, SID/STAR, ILS ani neověřený provoz.</p>
 </section>;
}
