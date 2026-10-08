import {useEffect,useState} from 'react';
import type {TelemetrySnapshot} from '../telemetry/types';
import {fuelPerformance,type FuelPoint} from './fuelMath';
import './FuelMonitor.css';
type Systems={connected:boolean;systems:{
  timestampUtc:string;fuelGallons:number;groundSpeedKnots:number;mode:string}|null};
export default function FuelMonitor({telemetry}:{telemetry:TelemetrySnapshot|null}){
  const [points,setPoints]=useState<FuelPoint[]>([]);
  const [reserve,setReserve]=useState(30);
  const [current,setCurrent]=useState<Systems|null>(null);
  useEffect(()=>{
    setPoints([]);setCurrent(null);
    if(!telemetry)return;
    let dead=false;
    async function poll(){
      try{
        const r=await fetch('/api/aircraft/systems',{cache:'no-store'});
        if(!r.ok)throw Error();
        const data=await r.json() as Systems;
        if(dead)return;
        setCurrent(data);
        if(!data.connected||!data.systems||data.systems.mode!=='simconnect')return;
        const fuel=data.systems.fuelGallons;
        const at=Date.parse(data.systems.timestampUtc);
        if(!Number.isFinite(fuel)||fuel<0||!Number.isFinite(at))return;
        setPoints(old=>{
          if(old.some(x=>x.at===at))return old;
          const last=old.at(-1);
          if(last&&(at<=last.at||at-last.at>35000||fuel>last.gallons+0.05))
            return [{at,gallons:fuel}];
          return [...old,{at,gallons:fuel}].slice(-40);
        });
      }catch{if(!dead)setCurrent(null);}
    }
    void poll();
    const interval=window.setInterval(()=>void poll(),10000);
    return()=>{dead=true;window.clearInterval(interval);};
  },[telemetry?.aircraft,!!telemetry]);
  const result=fuelPerformance(points,reserve);
  const gallons=current?.connected?current.systems?.fuelGallons:null;
  return <section className="fuel-monitor">
    <h2>C25 · Palivo a vytrvalost</h2>
    <p>Odhad z rozdílu skutečného množství paliva v MSFS během posledních
      minimálně dvou minut. Není to měřený průtok motoru ani navigační garance.</p>
    <label>Rezerva paliva
      <select value={reserve} onChange={e=>setReserve(Number(e.target.value))}>
        <option value={30}>30 minut</option><option value={45}>45 minut</option>
        <option value={60}>60 minut</option>
      </select>
    </label>
    <div className="fuel-monitor-grid">
      <article><small>Palivo na palubě</small><strong>
        {gallons==null?'—':gallons.toFixed(1)+' gal'}</strong></article>
      <article><small>Odhadovaná spotřeba</small><strong>
        {result?result.burnGallonsPerHour.toFixed(1)+' gal/h':'—'}</strong></article>
      <article><small>Odhadovaná vytrvalost</small><strong>
        {result?Math.floor(result.enduranceHours*60)+' min':'—'}</strong></article>
      <article><small>Do rezervy</small><strong>
        {result?Math.floor(result.afterReserveHours*60)+' min':'—'}</strong></article>
    </div>
    {!result&&<p role="status">Pro bezpečný odhad zatím není dost souvislých
      důvěryhodných vzorků. Počkejte alespoň 2 minuty stabilního letu
      a zaznamenatelné spotřeby.</p>}
    <p>Změna letadla, doplnění paliva nebo výpadek telemetrie sběr resetuje.
      Odhad není vhodný pro skutečné plánování palivových rezerv.</p>
  </section>;
}
