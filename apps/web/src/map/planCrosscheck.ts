import type { ImportedWaypoint } from './pln';
import type { Navigation } from './FlightNavigation';
import { metersBetween } from './geo';
export type MatchResult = {state:'no-plan'|'no-active'|'match'|'uncertain'|'different';description:string};
export function comparePlan(points:ImportedWaypoint[], navigation:Navigation|null):MatchResult {
  if(!points.length)return {state:'no-plan',description:'Žádná ručně importovaná ani SimBrief trasa.'};
  if(!navigation?.flightPlanActive||!navigation.waypointActive)
    return {state:'no-active',description:'MSFS neposkytuje potvrzený aktivní úsek.'};
  if(navigation.nextWaypoint){
    const distance=points.map(p=>metersBetween(p,navigation.nextWaypoint!));
    const closest=Math.min(...distance);
    if(closest<2*1852)return {state:'match',description:'Souřadnice aktuálního GPS bodu jsou do 2 NM od bodu importované trasy.'};
  }
  const id=navigation.nextWaypointId?.trim().toUpperCase();
  if(id&&points.some(p=>p.id.trim().toUpperCase()===id))
    return {state:'match',description:'Identifikátor aktivního bodu se vyskytuje v importované trase.'};
  return {state:'uncertain',description:'Aktivní bod není potvrzen v importovaném plánu; může jít o jinou trasu nebo odlišnou avioniku.'};
}
