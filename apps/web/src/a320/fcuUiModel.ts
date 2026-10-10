/** Visual FCU reference control definitions. Never implies a verified Airbus FMA mode. */
export type FcuField='speed'|'mach'|'heading'|'altitude'|'vs';
export type FcuReference={
 timestampUtc:string;selectedSpeedKnots:number;selectedMach:number;
 selectedHeadingDegrees:number;selectedAltitudeFeet:number;
 selectedVerticalSpeedFpm:number;autopilotMaster:boolean
};
export type FcuSpec={id:FcuField;label:string;unit:string;min:number;max:number;step:number;
 command:string;value:(f:FcuReference)=>number};
export const fcuSpecs:Record<FcuField,FcuSpec>={
 speed:{id:'speed',label:'SPD',unit:'KT',min:100,max:350,step:1,
   command:'a320.fcu.speed.set',value:f=>f.selectedSpeedKnots},
 mach:{id:'mach',label:'MACH',unit:'M',min:.1,max:.95,step:.01,
   command:'a320.fcu.mach.set',value:f=>f.selectedMach},
 heading:{id:'heading',label:'HDG',unit:'DEG',min:0,max:359,step:1,
   command:'a320.fcu.heading.set',value:f=>f.selectedHeadingDegrees},
 altitude:{id:'altitude',label:'ALT',unit:'FT',min:100,max:49000,step:100,
   command:'a320.fcu.altitude.set',value:f=>f.selectedAltitudeFeet},
 vs:{id:'vs',label:'V/S',unit:'FPM',min:-6000,max:6000,step:100,
   command:'a320.fcu.vs.set',value:f=>f.selectedVerticalSpeedFpm}
};
export const orderedFcuFields: FcuField[]=['speed','heading','altitude','vs'];
export function formatFcuValue(field:FcuField,value:number|null|undefined):string {
 if(value===null||value===undefined||!Number.isFinite(value))return '---';
 if(field==='mach')return value.toFixed(2);
 if(field==='altitude')return Math.round(value).toLocaleString('en-US');
 if(field==='vs')return (value>0?'+':'')+Math.round(value);
 return String(Math.round(value)).padStart(3,'0');
}
export function validateFcuReference(field:FcuField,value:number):boolean {
 const spec=fcuSpecs[field];
 return Number.isFinite(value)&&value>=spec.min&&value<=spec.max&&
   Math.abs(value/spec.step-Math.round(value/spec.step))<0.000001;
}
export function nextFcuReference(field:FcuField,current:number,delta:-1|1):number|null {
 const spec=fcuSpecs[field];
 if(!Number.isFinite(current))return null;
 const rounded=Math.round(current/spec.step)*spec.step+delta*spec.step;
 const next=field==='mach'?Math.round(rounded*100)/100:Math.round(rounded);
 return validateFcuReference(field,next)?next:null;
}
export function fcuDataFresh(live:boolean,aircraft:string,readbackAircraft:string|null,
 ageMs:number|null,fcu:FcuReference|null):boolean {
 return live&&!!aircraft&&aircraft===readbackAircraft&&fcu!==null&&
  ageMs!==null&&Number.isFinite(ageMs)&&ageMs>=0&&ageMs<3000&&
  [fcu.selectedSpeedKnots,fcu.selectedMach,fcu.selectedHeadingDegrees,
   fcu.selectedAltitudeFeet,fcu.selectedVerticalSpeedFpm].every(Number.isFinite);
}
