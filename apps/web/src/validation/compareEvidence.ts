import type { ValidationEvidence } from './validationEvidence';

export type EvidenceChange = {
  label: string; before: number | boolean; after: number | boolean;
  delta: number | null; unit: string;
};
type SampleValue = number | boolean | null;
type Datum = {name:string; unit:string; before:SampleValue; after:SampleValue};
const metric = (name:string,unit:string,before:SampleValue,after:SampleValue):Datum =>
  ({name,unit,before,after});

/** Only a comparison of two fresh read-only measurements. Never asserts that a
 * button worked or that an aircraft is certified. */
export function compareEvidence(baseline: ValidationEvidence, latest: ValidationEvidence) {
  const start=Date.parse(baseline.capturedAtUtc), end=Date.parse(latest.capturedAtUtc);
  const comparable=baseline.telemetry.live && latest.telemetry.live
    && Number.isFinite(start) && Number.isFinite(end)
    && end>start && end-start <= 15*60_000;
  if (!comparable) return {comparable:false,changes:[] as EvidenceChange[]};
  const specs:Datum[]=[
    metric('Příjem SimConnect','Hz',baseline.telemetry.incomingRateHz,latest.telemetry.incomingRateHz),
    metric('Publikace telemetrie','Hz',baseline.telemetry.sampleRateHz,latest.telemetry.sampleRateHz),
  ];
  if(baseline.systems.available && latest.systems.available){
    specs.push(
      metric('Na zemi','',baseline.systems.onGround,latest.systems.onGround),
      metric('AGL','ft',baseline.systems.altitudeAglFeet,latest.systems.altitudeAglFeet),
      metric('TAS','kt',baseline.systems.trueAirspeedKnots,latest.systems.trueAirspeedKnots),
      metric('Otáčky motoru','RPM',baseline.systems.engineRpm,latest.systems.engineRpm),
      metric('Palivo','gal',baseline.systems.fuelGallons,latest.systems.fuelGallons),
    );
  }
  if(baseline.navigation.available && latest.navigation.available){
    specs.push(
      metric('Aktivní plán','',baseline.navigation.flightPlanActive,latest.navigation.flightPlanActive),
      metric('Aktivní waypoint','',baseline.navigation.waypointActive,latest.navigation.waypointActive),
      metric('Index waypointu','',baseline.navigation.waypointIndex,latest.navigation.waypointIndex),
      metric('Počet waypointů','',baseline.navigation.waypointCount,latest.navigation.waypointCount),
      metric('Vzdálenost GPS','NM',baseline.navigation.distanceNauticalMiles,latest.navigation.distanceNauticalMiles),
      metric('Odchylka GPS','NM',baseline.navigation.crossTrackNauticalMiles,latest.navigation.crossTrackNauticalMiles),
    );
  }
  const changes:EvidenceChange[]=specs.flatMap(({name,unit,before,after})=>{
    if(before===null||after===null||before===after)return [];
    return [{label:name,unit,before,after,delta:
      typeof before==='number' && typeof after==='number'
        ? Math.round((after-before)*100)/100 : null}];
  });
  return {comparable:true,changes};
}
