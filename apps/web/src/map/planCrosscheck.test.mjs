import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePlan} from './planCrosscheck.ts';

const points=[
 {id:'VLM',latitude:50,longitude:14},
 {id:'KOLIN',latitude:50.0,longitude:15},
 {id:'SOME',latitude:49,longitude:15},
];
const nav=(patch={})=>({
 flightPlanActive:true,waypointActive:true,waypointCount:3,waypointIndex:1,
 nextWaypointId:'KOLIN',nextWaypoint:{latitude:50.001,longitude:15.001},
 ...patch,
});

test('C44 verifies both identifier and position without claiming full route sync',()=>{
 const actual=comparePlan(points,nav());
 assert.equal(actual.state,'match');
 assert.equal(actual.evidence,'position+ident');
 assert.equal(actual.importedIndex,1);
 assert.ok(actual.separationNm<2);
});
test('C44 never promotes an ID-only match to proven GPS geometry',()=>{
 const actual=comparePlan(points,nav({nextWaypoint:null}));
 assert.equal(actual.state,'uncertain');
 assert.equal(actual.evidence,'identifier');
});
test('C44 detects identical ID with contradictory coordinates',()=>{
 const actual=comparePlan(points,nav({nextWaypoint:{latitude:52,longitude:18}}));
 assert.equal(actual.state,'different');
 assert.equal(actual.evidence,'identifier');
});
test('C44 location near waypoint with different ID does not assert ID agreement',()=>{
 const actual=comparePlan(points,nav({nextWaypointId:'OTHER'}));
 assert.equal(actual.state,'uncertain');
 assert.equal(actual.evidence,'position');
});
test('C44 rejects mock/inactive GPS and invalid imported geometry',()=>{
 assert.equal(comparePlan([],nav()).state,'no-plan');
 assert.equal(comparePlan(points,nav({flightPlanActive:false})).state,'no-active');
 assert.equal(comparePlan([{id:'KOLIN',latitude:NaN,longitude:15}],nav()).state,'uncertain');
 assert.equal(comparePlan(points,nav({nextWaypoint:{latitude:91,longitude:15}})).state,'uncertain');
});
