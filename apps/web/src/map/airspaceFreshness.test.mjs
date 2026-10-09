import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAirspaceSource} from './airspaceFreshness.ts';
const now=Date.parse('2026-10-09T07:00:00Z');
test('C45 old fixed Czech public OpenAir file requires explicit acknowledgement',()=>{
 const state=assessAirspaceSource('2026-04-01',false,now);
 assert.equal(state.usable,true);
 assert.equal(state.requiresAcknowledgement,true);
 assert.ok(state.ageDays>56);
});
test('C45 stale cache cannot silently be trusted despite new effective date',()=>{
 assert.equal(assessAirspaceSource('2026-10-01',true,now).requiresAcknowledgement,true);
 assert.equal(assessAirspaceSource('2026-10-01',false,now).requiresAcknowledgement,false);
});
test('C45 invalid, future and missing dates fail closed',()=>{
 for(const date of [null,'today','2030-01-01','']) {
   const x=assessAirspaceSource(date,false,now);
   assert.equal(x.usable,false);
   assert.equal(x.requiresAcknowledgement,true);
 }
});
