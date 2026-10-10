/** A320 read-only system evidence. No unsafe control mapping is inferred from
 * a generic SimVar and no data survives the trusted aircraft generation.
 */
export type CockpitSystemFlags={
 timestampUtc:string;landing:boolean;taxi:boolean;nav:boolean;
 beacon:boolean;strobe:boolean;pitot:boolean;parkingBrake:boolean
};
export type CockpitSystemsResponse={
 connected:boolean;sampleAgeMs:number|null;
 systems:CockpitSystemFlags|null
};
export function cockpitSystemsFresh(
 response:CockpitSystemsResponse|null,
 observedAircraft:string|null,
 requestedAircraft:string,
 trusted:boolean
):response is CockpitSystemsResponse&{systems:CockpitSystemFlags}{
 const age=response?.sampleAgeMs;
 return trusted&&!!requestedAircraft&&observedAircraft===requestedAircraft&&
  response?.connected===true&&response.systems!==null&&
  age!==null&&age!==undefined&&Number.isFinite(age)&&age>=0&&age<6000;
}
export function latestValue<T>(value:T|null|undefined,ageMs:number|null|undefined,
 maxAge=6000):T|null {
 return value!==undefined&&value!==null&&ageMs!==undefined&&ageMs!==null&&
  Number.isFinite(ageMs)&&ageMs>=0&&ageMs<maxAge?value:null;
}
export function aircraftSystemLabel(value:boolean|null|undefined):string{
 return value===true?'ON':value===false?'OFF':'—';
}
export function systemNumber(value:number|null|undefined,digits=0):string{
 return value!==null&&value!==undefined&&Number.isFinite(value)
  ?value.toFixed(digits):'—';
}
