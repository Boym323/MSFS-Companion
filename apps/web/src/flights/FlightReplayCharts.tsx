import type {TelemetrySnapshot} from '../telemetry/types';
import {seriesPath} from './chartMath';
import './FlightReplayCharts.css';
const charts:[
 {key:'altitudeFeet';label:string;unit:string;color:string},
 {key:'airspeedKnots';label:string;unit:string;color:string},
 {key:'verticalSpeedFeetPerMinute';label:string;unit:string;color:string},
 {key:'bankDegrees';label:string;unit:string;color:string}
]=[
 {key:'altitudeFeet',label:'Výška',unit:'ft',color:'#7dd3fc'},
 {key:'airspeedKnots',label:'IAS',unit:'kt',color:'#f5d18d'},
 {key:'verticalSpeedFeetPerMinute',label:'Vertikální rychlost',unit:'ft/min',color:'#a5dbb9'},
 {key:'bankDegrees',label:'Náklon',unit:'°',color:'#e6b0ed'},
];
export default function FlightReplayCharts({samples,index}:{
 samples:TelemetrySnapshot[];index:number}){
  const cursorX=10+Math.max(0,Math.min(index,Math.max(0,samples.length-1)))*
    600/Math.max(1,samples.length-1);
  return <section className="flight-replay-charts" aria-label="Grafy přehrávání letu">
    <h3>C28 · Synchronizovaná časová osa</h3>
    <p>Orientační grafy uložených vzorků, žlutá svislá čára ukazuje
      aktuální bod v přehrávání. Dlouhé lety jsou pro zobrazení převzorkované.</p>
    {charts.map(c=>{
      const values=samples.map(p=>p[c.key]);
      const value=samples[index]?.[c.key];
      return <article key={c.key}>
        <div><strong>{c.label}</strong><span>{value!=null&&Number.isFinite(value)
          ?value.toFixed(1)+' '+c.unit:'—'}</span></div>
        <svg viewBox="0 0 620 94" role="img" aria-label={c.label+' během letu'}>
          <path d={seriesPath(values)} fill="none" stroke={c.color}
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <line x1={cursorX} y1="4" x2={cursorX} y2="90"
            stroke="#f6df89" strokeWidth="2" strokeDasharray="5 4"/>
        </svg>
      </article>;
    })}
  </section>;
}
