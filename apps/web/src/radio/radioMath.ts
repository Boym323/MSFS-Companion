export type AirportFrequency={type:string;description:string;frequencyMhz:number};
/** OurAirports frequency is only a suggestion. SimConnect allowlist decides again. */
export function allowedComStandby(mhz:number):number|null{
  if(!Number.isFinite(mhz))return null;
  const hz=Math.round(mhz*1_000_000);
  if(hz<118_000_000||hz>136_990_000||hz%5_000!==0||
    Math.abs(mhz*1_000_000-hz)>0.1)return null;
  return hz;
}
export function comFrequencies(items:AirportFrequency[]):AirportFrequency[]{
  return items.filter(x=>x&&allowedComStandby(x.frequencyMhz)!==null).slice(0,30);
}
