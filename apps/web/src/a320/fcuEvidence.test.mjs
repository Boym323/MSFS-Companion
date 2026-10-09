import test from 'node:test';
import assert from 'node:assert/strict';
import {compareA320FcuEvidence} from './fcuEvidence.ts';
const base={
 aircraft:'Airbus A320 Neo',capturedAtUtc:'2026-10-09T10:00:00Z',
 fcu:{timestampUtc:'2026-10-09T09:59:59Z',
 selectedSpeedKnots:250,selectedMach:0.78,selectedHeadingDegrees:90,
 selectedAltitudeFeet:10000,selectedVerticalSpeedFpm:0,
 speedSlotIndex:1,headingSlotIndex:1,altitudeSlotIndex:1,
 verticalSpeedSlotIndex:1,autopilotMaster:false}
};
const future={...base,capturedAtUtc:'2026-10-09T10:00:10Z',
 fcu:{...base.fcu,timestampUtc:'2026-10-09T10:00:09Z'}};
test('A320-07 observed change is not labelled actuator confirmed',()=>{
 const comparison=compareA320FcuEvidence(base,{
  ...future,fcu:{...future.fcu,selectedHeadingDegrees:110,headingSlotIndex:2}
 });
 assert.equal(comparison.state,'observed');
 assert.match(comparison.reason,/nikoli potvrzená/);
 assert.equal(comparison.changes.length,2);
});
test('A320-07 same data is unchanged and invalid identity is inconclusive',()=>{
 assert.equal(compareA320FcuEvidence(base,future).state,'unchanged');
 assert.equal(compareA320FcuEvidence(base,{...future,aircraft:'Cessna 172'}).state,'inconclusive');
 assert.equal(compareA320FcuEvidence(base,{...future,
   fcu:{...future.fcu,timestampUtc:base.fcu.timestampUtc}}).state,'inconclusive');
});
test('A320-07 old and invalid telemetry never produce verified evidence',()=>{
 assert.equal(compareA320FcuEvidence(base,{...future,
   capturedAtUtc:'2026-10-09T10:17:00Z'}).state,'inconclusive');
 assert.equal(compareA320FcuEvidence(base,{...future,
   fcu:{...future.fcu,selectedMach:NaN}}).state,'inconclusive');
});
