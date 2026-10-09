import type { ImportedWaypoint } from './pln';
import type { Navigation } from './FlightNavigation';
import { metersBetween } from './geo.ts';

export type MatchResult = {
  state:'no-plan'|'no-active'|'match'|'uncertain'|'different';
  description:string;
  importedIndex?:number;
  separationNm?:number;
  evidence?:'position+ident'|'position'|'identifier'|'none';
};
const normalizedId=(id:string|null|undefined)=>(id??'').trim().toUpperCase();
const validPoint=(point:{latitude:number;longitude:number})=>
  Number.isFinite(point.latitude)&&Number.isFinite(point.longitude)
  &&Math.abs(point.latitude)<=85.05&&Math.abs(point.longitude)<=180;

/** Read-only reconciliation, not proof of a full onboard flight plan. */
export function comparePlan(points:ImportedWaypoint[],navigation:Navigation|null):MatchResult {
  if(points.length===0)return {state:'no-plan',description:'Žádná ručně importovaná ani SimBrief trasa.'};
  if(!navigation?.flightPlanActive||!navigation.waypointActive)
    return {state:'no-active',description:'MSFS neposkytuje potvrzený aktivní úsek.'};
  const verified=points.slice(0,400).filter(p=>validPoint(p)&&typeof p.id==='string');
  if(!verified.length)return {state:'uncertain',evidence:'none',
    description:'Importovaná trasa nemá validní souřadnice.'};
  const id=normalizedId(navigation.nextWaypointId);
  const matchingIds=id?verified.flatMap((p,index)=>normalizedId(p.id)===id?[index]:[]):[];
  const active=navigation.nextWaypoint;
  if(!active||!validPoint(active)){
    return {state:'uncertain',evidence:matchingIds.length?'identifier':'none',
      description:matchingIds.length
        ?'Shoduje se pouze identifikátor waypointu, GPS souřadnice nejsou dostupné.'
        :'Souřadnice aktivního GPS waypointu nejsou dostupné.'};
  }
  const distances=verified.map(p=>metersBetween(p,active)/1852);
  const minimum=Math.min(...distances);
  const index=distances.indexOf(minimum);
  // A nearby geographic point can still be a different instance of the same identifier.
  const sameId=matchingIds.includes(index);
  if(minimum<=2){
    return {state:'match',evidence:sameId?'position+ident':'position',
      importedIndex:index,separationNm:Math.round(minimum*100)/100,
      description:sameId
        ?`Identifikátor i poloha GPS bodu odpovídají bodu č. ${index+1} importované trasy (do 2 NM).`
        :`Poloha GPS bodu odpovídá bodu č. ${index+1} do 2 NM; identifikátor není potvrzený.`};
  }
  // An identical identifier at an incompatible coordinate is evidence of
  // a mismatch, but never evidence of complete flight-plan corruption.
  if(matchingIds.length&&Math.min(...matchingIds.map(i=>distances[i]))>10){
    return {state:'different',evidence:'identifier',importedIndex:matchingIds[0],
      description:'Stejný identifikátor waypointu má GPS polohu vzdálenou více než 10 NM od importovaného bodu. Ověřte databázi a aktivní leg.'};
  }
  return {state:'uncertain',evidence:'none',
    description:'Aktivní waypoint není jednoznačně doložen v importované trase. Neznamená to automaticky chybný plán.'};
}
