import { metersBetween } from './geo.ts';
import type { SimTrafficTarget } from './useSimTraffic';

type Ownship = {latitude:number; longitude:number; altitudeFeet:number; headingDegrees:number};
export type RelativeTraffic = {
  objectId:number; distanceNm:number; bearingTrue:number; relativeDegrees:number;
  side:'vpředu'|'vpravo'|'vlevo'|'vzadu'; altitudeDifferenceFeet:number;
  onGround:boolean;
};
function bearing(a:Ownship,b:SimTrafficTarget):number {
  const r=Math.PI/180, dLon=(((b.longitude-a.longitude+540)%360)-180)*r;
  const x=Math.sin(dLon)*Math.cos(b.latitude*r);
  const y=Math.cos(a.latitude*r)*Math.sin(b.latitude*r)
    -Math.sin(a.latitude*r)*Math.cos(b.latitude*r)*Math.cos(dLon);
  return (Math.atan2(x,y)/r+360)%360;
}
/** Informational geometry only; no trajectories, velocities or TCAS claims. */
export function relativeTraffic(
  ownship:Ownship|null,targets:SimTrafficTarget[],maxResults=5
):RelativeTraffic[]{
  if(!ownship||![ownship.latitude,ownship.longitude,ownship.altitudeFeet,
    ownship.headingDegrees].every(Number.isFinite)||
    Math.abs(ownship.latitude)>85.05||Math.abs(ownship.longitude)>180)return [];
  return targets.slice(0,100).flatMap(target=>{
    if(!Number.isInteger(target.objectId)||target.objectId<=0||
       ![target.latitude,target.longitude,target.altitudeFeet].every(Number.isFinite)||
       Math.abs(target.latitude)>85.05||Math.abs(target.longitude)>180)return [];
    const distance=metersBetween(ownship,target)/1852;
    if(!Number.isFinite(distance)||distance<0.01||distance>100)return [];
    const absolute=bearing(ownship,target);
    const relative=(absolute-((ownship.headingDegrees%360+360)%360)+360)%360;
    const side=relative<=25||relative>=335?'vpředu'
      :relative<155?'vpravo':relative<=205?'vzadu':'vlevo';
    return [{objectId:target.objectId,distanceNm:Math.round(distance*10)/10,
      bearingTrue:Math.round(absolute),relativeDegrees:Math.round(relative),
      side,altitudeDifferenceFeet:Math.round(target.altitudeFeet-ownship.altitudeFeet),
      onGround:target.onGround} satisfies RelativeTraffic];
  }).sort((a,b)=>a.distanceNm-b.distanceNm).slice(0,Math.max(0,Math.min(maxResults,10)));
}
