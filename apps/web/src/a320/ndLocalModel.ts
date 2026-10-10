/** Safe, local-only display model for the A320 ND companion.
 * Never infers or writes simulator EFIS selectors or Airbus FMS.
 */
export const ND_RANGES=[10,20,40,80,160,320] as const;
export type NdRange=typeof ND_RANGES[number];
export type NdMode='ARC'|'ROSE NAV';
export type GeoPosition={latitude:number;longitude:number};
export type NdFix={id:string|null;distanceNm:number;bearingDegrees:number;
 relativeBearingDegrees:number;withinRange:boolean;x:number;y:number};
const RAD=Math.PI/180;
export function wrapDegrees(value:number):number {
 return ((value%360)+360)%360;
}
export function signedDegrees(value:number):number{
 return ((value+540)%360+360)%360-180;
}
export function positionValid(p:GeoPosition|null|undefined):p is GeoPosition{
 return !!p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&
  Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
}
export function validSample(timestamp:string|undefined,now:number,
 maxAgeMs=6000):boolean{
 if(!timestamp||!Number.isFinite(now))return false;
 const t=Date.parse(timestamp);
 return Number.isFinite(t)&&t<=now+1000&&now-t>=-1000&&now-t<=maxAgeMs;
}
export function waypointOnNd(
 ownship:GeoPosition|null,waypoint:GeoPosition|null,
 ownHeading:number,range:NdRange,mode:NdMode,id:string|null
):NdFix|null{
 if(!positionValid(ownship)||!positionValid(waypoint)||
  !Number.isFinite(ownHeading)||!ND_RANGES.includes(range)||
  !['ARC','ROSE NAV'].includes(mode))return null;
 const lat1=ownship.latitude*RAD,lat2=waypoint.latitude*RAD;
 const dLat=lat2-lat1;
 const dLon=((waypoint.longitude-ownship.longitude+540)%360-180)*RAD;
 const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 const distanceNm=(2*3440.065)*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
 const y=Math.sin(dLon)*Math.cos(lat2);
 const x=Math.cos(lat1)*Math.sin(lat2)-
  Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
 const bearingDegrees=wrapDegrees(Math.atan2(y,x)/RAD);
 const relativeBearingDegrees=signedDegrees(bearingDegrees-wrapDegrees(ownHeading));
 const radius=mode==='ARC'?270:175;
 const centerY=mode==='ARC'?394:231;
 const d=Math.min(distanceNm/range,1)*radius;
 const angle=relativeBearingDegrees*RAD;
 return {
  id:id?.trim().slice(0,14)||null,distanceNm,bearingDegrees,
  relativeBearingDegrees,withinRange:distanceNm<=range,
  x:300+Math.sin(angle)*d,
  y:centerY-Math.cos(angle)*d
 };
}
export function headingLabel(value:number|null|undefined){
 return value!==null&&value!==undefined&&Number.isFinite(value)
  ?String(Math.round(wrapDegrees(value))).padStart(3,'0')+'°':'---';
}
