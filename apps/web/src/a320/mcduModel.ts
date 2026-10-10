/** Type-safe, read-only payload for the original Asobo A320 MCDU companion.
 * This is a generic GPS leg, NOT Airbus FMS state or a screen capture.
 */
export type McduGps = {
 flightPlanActive:boolean;waypointActive:boolean;
 waypointCount:number;waypointIndex:number;nextWaypointId:string|null;
 distanceNauticalMiles:number|null;eteSeconds:number|null;
 desiredTrackDegrees:number|null;crossTrackNauticalMiles:number|null;
 totalFlightPlanNauticalMiles:number|null;groundTrackDegrees:number|null;
};
export type McduStatus={
 connected:boolean;aircraft:string|null;profileId:string;
 mcduScreenAvailable:boolean;mcduKeysAvailable:boolean;
 mcduFlightPlanVerified:boolean;keyActions:string[];
 source:string;gpsAgeMs:number|null;gps:McduGps|null;
 note:string
};
export type McduPage='F-PLN'|'PROG'|'STATUS';
export function freshMcduGps(status:McduStatus|null,
 selectedAircraft:string,live:boolean,elapsedMs:number):McduGps|null{
 if(!live||!selectedAircraft||status?.connected!==true||
    status.aircraft!==selectedAircraft||
    status.profileId!=='a320-asobo-candidate'||
    status.source!=='generic_gps_simvars'||
    !status.gps||status.gpsAgeMs===null||
    !Number.isFinite(status.gpsAgeMs)||
    !Number.isFinite(elapsedMs)||elapsedMs<0||
    status.gpsAgeMs<0||status.gpsAgeMs+elapsedMs>=6000)return null;
 const g=status.gps;
 if(!Number.isInteger(g.waypointCount)||g.waypointCount<0||g.waypointCount>500||
    !Number.isInteger(g.waypointIndex)||g.waypointIndex<0||
    g.waypointIndex>500)return null;
 return g;
}
export function mcduValue(value:number|null|undefined,
 decimals=0,suffix=''):string {
 if(value===null||value===undefined||!Number.isFinite(value))return '---';
 return value.toFixed(decimals)+suffix;
}
export function mcduMinutes(seconds:number|null|undefined):string {
 return seconds===null||seconds===undefined||!Number.isFinite(seconds)||
  seconds<0?'---':String(Math.ceil(seconds/60))+' MIN';
}
export function mcduWaypointName(gps:McduGps|null):string {
 if(!gps||!gps.flightPlanActive||!gps.waypointActive)return '-----';
 return (gps.nextWaypointId??'GPS WP').slice(0,14).toUpperCase();
}
