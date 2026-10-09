import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateDescentToWaypoint} from './descentEstimate.ts';
test('C48 computes time and distance to the active GPS waypoint only',()=>{
 const result=estimateDescentToWaypoint({currentAltitudeFeet:10500,
 targetAltitudeFeet:2500,descentFpm:1000,distanceNm:80,eteSeconds:1200});
 assert.deepEqual(result,{minutes:8,requiredDistanceNm:32,
   remainingBeforeTodNm:48,groundSpeedKnots:240,status:'ahead'});
});
test('C48 never fabricates TOD when altitude, ETE or GS is unavailable',()=>{
 const sample={currentAltitudeFeet:10500,targetAltitudeFeet:2500,
 descentFpm:1000,distanceNm:80,eteSeconds:1200};
 for(const invalid of [
   {eteSeconds:0},{eteSeconds:Infinity},{distanceNm:0},
   {targetAltitudeFeet:12000},{descentFpm:0},{eteSeconds:100},
   {targetAltitudeFeet:-150},{currentAltitudeFeet:NaN},
 ])assert.equal(estimateDescentToWaypoint({...sample,...invalid}),null);
});
test('C48 marks descent point as passed without negative distance',()=>{
 const result=estimateDescentToWaypoint({currentAltitudeFeet:10500,
 targetAltitudeFeet:2500,descentFpm:1000,distanceNm:12,eteSeconds:180});
 assert.equal(result?.status,'at-or-past');
 assert.equal(result?.remainingBeforeTodNm,0);
});
