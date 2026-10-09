/** Pure, read-only A320 FCU evidence comparison. Observed change ≠ confirmed actuator. */
export type FcuEvidence={
 aircraft:string;capturedAtUtc:string;
 fcu:{
  timestampUtc:string;selectedSpeedKnots:number;selectedMach:number;
  selectedHeadingDegrees:number;selectedAltitudeFeet:number;
  selectedVerticalSpeedFpm:number;speedSlotIndex:number;
  headingSlotIndex:number;altitudeSlotIndex:number;verticalSpeedSlotIndex:number;
  autopilotMaster:boolean
 }
};
export type FcuEvidenceResult={
 state:'inconclusive'|'unchanged'|'observed';reason:string;changes:string[]
};
const validTime=(s:string)=>Number.isFinite(Date.parse(s));
export function compareA320FcuEvidence(before:FcuEvidence|null,
  after:FcuEvidence|null):FcuEvidenceResult {
 if(!before||!after||!before.aircraft||before.aircraft!==after.aircraft)
  return {state:'inconclusive',reason:'Chybí dvě měření ze stejného letadla.',changes:[]};
 if(!validTime(before.capturedAtUtc)||!validTime(after.capturedAtUtc)||
   !validTime(before.fcu.timestampUtc)||!validTime(after.fcu.timestampUtc))
  return {state:'inconclusive',reason:'Neplatné časy diagnostiky.',changes:[]};
 const age=Date.parse(after.capturedAtUtc)-Date.parse(before.capturedAtUtc);
 const dataGap=Date.parse(after.fcu.timestampUtc)-Date.parse(before.fcu.timestampUtc);
 if(age<=0||age>15*60_000||dataGap<=0)
  return {state:'inconclusive',reason:'Měření jsou stará, časově obrácená nebo bez nového vzorku.',changes:[]};
 const changes:string[]=[];
 const numbers=[
  ['SPD',before.fcu.selectedSpeedKnots,after.fcu.selectedSpeedKnots,0.5],
  ['MACH',before.fcu.selectedMach,after.fcu.selectedMach,0.005],
  ['HDG',before.fcu.selectedHeadingDegrees,after.fcu.selectedHeadingDegrees,0.5],
  ['ALT',before.fcu.selectedAltitudeFeet,after.fcu.selectedAltitudeFeet,10],
  ['V/S',before.fcu.selectedVerticalSpeedFpm,after.fcu.selectedVerticalSpeedFpm,20],
  ['SPD slot',before.fcu.speedSlotIndex,after.fcu.speedSlotIndex,0],
  ['HDG slot',before.fcu.headingSlotIndex,after.fcu.headingSlotIndex,0],
  ['ALT slot',before.fcu.altitudeSlotIndex,after.fcu.altitudeSlotIndex,0],
  ['VS slot',before.fcu.verticalSpeedSlotIndex,after.fcu.verticalSpeedSlotIndex,0]
 ] as const;
 if(numbers.some(([,a,b])=>!Number.isFinite(a)||!Number.isFinite(b)))
  return {state:'inconclusive',reason:'Neplatné číselné hodnoty FCU.',changes:[]};
 for(const [label,a,b,threshold] of numbers)
  if(Math.abs(a-b)>threshold)changes.push(label+': '+a+' → '+b);
 if(before.fcu.autopilotMaster!==after.fcu.autopilotMaster)
  changes.push('AP master: '+before.fcu.autopilotMaster+' → '+after.fcu.autopilotMaster);
 return changes.length
  ?{state:'observed',reason:'Pozorované změny obecných SimVars – nikoli potvrzená funkce FCU.',changes}
  :{state:'unchanged',reason:'Nebyla zjištěna změna obecného SimVar; to samo o sobě není závada.',changes};
}
