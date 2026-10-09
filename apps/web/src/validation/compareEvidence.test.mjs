import test from 'node:test';
import assert from 'node:assert/strict';
import { buildValidationEvidence } from './validationEvidence.ts';
import { compareEvidence } from './compareEvidence.ts';

const make=(t,rpm,index,mode='simconnect')=>buildValidationEvidence(
  {mode,connected:true,sampleRateHz:20,incomingRateHz:30,sampleAgeMs:500},
  {connected:true,sampleAgeMs:200,systems:{mode:'simconnect',engineRpm:rpm,onGround:false}},
  {connected:true,sampleAgeMs:200,navigation:{waypointIndex:index,waypointCount:5,flightPlanActive:true}},
  t,
);

test('C41 compares only controlled measurements and never asserts a pass',()=>{
  const result=compareEvidence(make('2026-10-09T06:00:00Z',900,1),make('2026-10-09T06:00:20Z',1800,2));
  assert.equal(result.comparable,true);
  assert.deepEqual(result.changes.map(p=>p.label),['Otáčky motoru','Index waypointu']);
  assert.equal(result.changes[0].delta,900);
  assert.ok(!('verified' in result));
});
test('C41 rejects stale, reversed, mock or identical snapshots',()=>{
  const a=make('2026-10-09T06:00:00Z',900,1);
  for(const b of [
    make('2026-10-09T06:16:00Z',1800,2),
    make('2026-10-09T05:59:00Z',1800,2),
    make('2026-10-09T06:00:10Z',1800,2,'mock'),
  ]) assert.equal(compareEvidence(a,b).comparable,false);
  assert.deepEqual(compareEvidence(a,make('2026-10-09T06:00:10Z',900,1)).changes,[]);
});
