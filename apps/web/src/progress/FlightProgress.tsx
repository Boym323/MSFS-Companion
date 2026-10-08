import { useFlightNavigation } from '../map/FlightNavigation';
import type { TelemetrySnapshot } from '../telemetry/types';
import './FlightProgress.css';

const display=(n:number|null,digits=1)=>n!==null&&Number.isFinite(n)?n.toFixed(digits):'—';
function angleDiff(a:number,b:number){return ((a-b+540)%360)-180;}
export default function FlightProgress({telemetry}:{telemetry:TelemetrySnapshot|null}){
  const navigation=useFlightNavigation(!!telemetry);
  const valid=navigation?.waypointActive&&navigation.flightPlanActive;
  const ete=valid?navigation?.eteSeconds:null;
  const eta=ete!=null&&Number.isFinite(ete)&&ete>=0&&ete<7*86400
    ?new Date(Date.now()+ete*1000).toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'})
    :'—';
  const track=valid&&navigation?.desiredTrackDegrees!=null&&navigation.groundTrackDegrees!=null
    ?angleDiff(navigation.groundTrackDegrees,navigation.desiredTrackDegrees):null;
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
      </>}
  </section>;
}
