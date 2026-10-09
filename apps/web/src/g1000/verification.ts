export type PilotResult = 'pass' | 'fail';
export type ManualVerification = {result:PilotResult; checkedAtUtc:string};
export type VerificationMap = Record<string,ManualVerification>;
const allowed=/^(?:pfd|mfd)\.(?:fms\.(?:inner|outer)|heading|nav\.(?:inner|outer)|fpl|proc|ent|cdi|obs|range|directto|menu|clr|softkey\.(?:[1-9]|1[012]))$/;

export function verificationKey(aircraft:string|null):string|null{
  if(!aircraft||aircraft.length>120||/[\x00-\x1f]/.test(aircraft)) return null;
  return 'kokpit-c43-manual-avionics:'+encodeURIComponent(aircraft.trim());
}
/** Imported browser data is never proof of a compatible avionics control. */
export function normalizeVerification(input:unknown,nowMs:number):VerificationMap{
  if(!input||typeof input!=='object'||Array.isArray(input)||!Number.isFinite(nowMs))return {};
  const result:VerificationMap={};
  for(const [id,item] of Object.entries(input).slice(0,120)){
    if(!allowed.test(id)||!item||typeof item!=='object'||Array.isArray(item))continue;
    const entry=item as Record<string,unknown>;
    const at=typeof entry.checkedAtUtc==='string'?Date.parse(entry.checkedAtUtc):NaN;
    if((entry.result!=='pass'&&entry.result!=='fail')||!Number.isFinite(at)||
      at>nowMs+60000||nowMs-at>90*86400_000)continue;
    result[id]={result:entry.result,checkedAtUtc:new Date(at).toISOString()};
  }
  return result;
}
export function pilotReviewAllowed(
  live:boolean, status:string|undefined, aircraft:string|null|undefined,
  offered:string[], action:string,
):boolean{
  return live&&status==='ready'&&!!verificationKey(aircraft??null)
    &&allowed.test(action)&&offered.includes(action);
}
