import { useState } from 'react';
import { useFlightNavigation } from '../map/FlightNavigation';
import { estimateDescentToWaypoint } from './descentEstimate';
import type { TelemetrySnapshot } from '../telemetry/types';
import './FlightProgress.css';

const display=(n:number|null,digits=1)=>n!==null&&Number.isFinite(n)?n.toFixed(digits):'—';
function angleDiff(a:number,b:number){return ((a-b+540)%360)-180;}
export default function FlightProgress({telemetry}:{telemetry:TelemetrySnapshot|null}){
  const [targetAlt,setTargetAlt]=useState(2500);
  const [descentRate,setDescentRate]=useState(1000);
  const navigation=useFlightNavigation(!!telemetry);
  const valid=navigation?.waypointActive&&navigation.flightPlanActive;
  const ete=valid?navigation?.eteSeconds:null;
  const eta=ete!=null&&Number.isFinite(ete)&&ete>=0&&ete<7*86400
    ?new Date(Date.now()+ete*1000).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})
    :'—';
  const track=valid&&navigation?.desiredTrackDegrees!=null&&navigation.groundTrackDegrees!=null
    ?angleDiff(navigation.groundTrackDegrees,navigation.desiredTrackDegrees):null;
  const tod=telemetry && valid && navigation?.distanceNauticalMiles!=null
    && navigation.eteSeconds!=null
    ?estimateDescentToWaypoint({
        currentAltitudeFeet:telemetry.altitudeFeet,
        targetAltitudeFeet:targetAlt,descentFpm:descentRate,
        distanceNm:navigation.distanceNauticalMiles,
        eteSeconds:navigation.eteSeconds})
    :null;
  return <section className="flight-progress">
    <h2>C24 · Průběh aktivního úseku</h2>
    {!telemetry||!navigation?<p>Čekám na živou navigaci ze simulátoru.</p>
      :!valid?<p>MSFS neposkytuje potvrzený aktivní GPS úsek. Údaje nevymýšlíme.</p>
      :<>
        <div className="flight-progress-grid">
          <article><small>Další navigační bod</small><strong>{navigation.nextWaypointId||'Aktivní GPS bod'}</strong></article>
          <article><small>Vzdálenost k bodu</small><strong>{display(navigation.distanceNauticalMiles)} NM</strong></article>
          <article><small>ETE k bodu</small><strong>{ete==null?'—':Math.round(ete/60)+' min'}</strong></article>
          <article><small>ETA k bodu (místní čas)</small><strong>{eta}</strong></article>
          <article><small>Odchylka od trasy</small><strong>{display(navigation.crossTrackNauticalMiles,2)} NM</strong></article>
          <article><small>Rozdíl trať / požadovaná trať</small><strong>{display(track,0)}°</strong></article>
          <article><small>Aktivní bod</small><strong>{navigation.waypointCount>0
            ?navigation.waypointIndex+1+' / '+navigation.waypointCount:'—'}</strong></article>
          <article><small>Celá délka plánu ze SimConnectu</small>
            <strong>{display(navigation.totalFlightPlanNauticalMiles)} NM</strong></article>
        </div>
        <p>ETA vychází ze zveřejněného ETE aktuálního bodu; není to předpověď času
          přistání ani cílového letiště. Záporný rozdíl tratí znamená odchylku doleva.</p>
        <section className="flight-progress-descent">
          <h3>C48 · Orientační plán sestupu k aktivnímu GPS bodu</h3>
          <div className="flight-progress-descent-inputs">
            <label>Cílová výška (ft MSL)
              <input type="number" min="0" max="45000" step="100"
                value={targetAlt} onChange={e=>setTargetAlt(Number(e.target.value))}/>
            </label>
            <label>Předpokládané klesání (ft/min)
              <select value={descentRate} onChange={e=>setDescentRate(Number(e.target.value))}>
                <option value={500}>500</option><option value={700}>700</option>
                <option value={1000}>1000</option><option value={1500}>1500</option>
              </select>
            </label>
          </div>
          {tod?<div className="flight-progress-grid">
            <article><small>Odhadovaná GS (z GPS ETE)</small><strong>{tod.groundSpeedKnots} kt</strong></article>
            <article><small>Čas potřebný ke klesání</small><strong>{tod.minutes.toFixed(1)} min</strong></article>
            <article><small>Zahájit přibližně před aktivním GPS bodem</small>
              <strong>{tod.requiredDistanceNm.toFixed(1)} NM</strong></article>
            <article><small>{tod.status==='ahead'?'Do předpokládaného TOD':'Orientační TOD'}</small>
              <strong>{tod.status==='ahead'?tod.remainingBeforeTodNm.toFixed(1)+' NM':
                'Dosažen / překročen'}</strong></article>
          </div>:<p role="status">Nelze vytvořit obhajitelný odhad:
            chybí čerstvý GPS úsek, ETE, věrohodná rychlost,
            nebo je cílová výška vyšší než aktuální.</p>}
          <p>Odhad je pouze aritmetika k aktuálnímu waypointu při stálé rychlosti
            a zvolené vertikální rychlosti. Nejde o VNAV, cílové letiště, ATC
            pokyn ani řízení autopilota; žádné povely do MSFS se neposílají.</p>
        </section>
      </>}
  </section>;
}
