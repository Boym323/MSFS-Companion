import test from 'node:test';
import assert from 'node:assert/strict';
import {ND_RANGES,waypointOnNd,validSample,wrapDegrees,signedDegrees,
 headingLabel} from './ndLocalModel.ts';

const zl={latitude:49.2265,longitude:17.6697};
test('EFIS local ND ranges are fixed Airbus-like presets',()=>{
 assert.deepEqual(ND_RANGES,[10,20,40,80,160,320]);
 assert.equal(headingLabel(NaN),'---');
 assert.equal(headingLabel(360),'000°');
});
test('waypoint bearings and range never produce fabricated route',()=>{
 const north={latitude:49.3265,longitude:17.6697};
 const near=waypointOnNd(zl,north,0,20,'ARC','TEST1');
 assert.ok(near); assert.ok(Math.abs(near.bearingDegrees)<.1);
 assert.ok(near.distanceNm>5&&near.distanceNm<7);
 assert.equal(near.withinRange,true);
 assert.ok(Math.abs(near.x-300)<1e-5);
 assert.ok(near.y<394);
 assert.equal(waypointOnNd(zl,null,0,20,'ARC',null),null);
 assert.equal(waypointOnNd(null,north,0,20,'ARC',null),null);
 const far=waypointOnNd(zl,{latitude:50.2265,longitude:17.6697},0,20,'ROSE NAV','');
 assert.equal(far?.withinRange,false);
});
test('heading relative bearing wraps across 360 and 180',()=>{
 assert.equal(wrapDegrees(-10),350);
 assert.equal(signedDegrees(350),-10);
 const near=waypointOnNd(zl,{latitude:49.3265,longitude:17.6697},
  350,20,'ROSE NAV','ABC');
 assert.ok(near); assert.ok(Math.abs(near.relativeBearingDegrees-10)<1);
});
test('geo validation and time freshness reject corrupted or stale data',()=>{
 assert.equal(waypointOnNd({latitude:91,longitude:17},zl,0,20,'ARC','X'),null);
 assert.equal(waypointOnNd(zl,zl,NaN,20,'ARC','X'),null);
 const now=Date.parse('2026-10-10T12:00:00Z');
 assert.equal(validSample('2026-10-10T11:59:58Z',now),true);
 assert.equal(validSample('2026-10-10T11:59:50Z',now),false);
 assert.equal(validSample('2026-10-10T12:00:04Z',now),false);
 assert.equal(validSample('invalid',now),false);
});
test('antimeridian uses short longitude path',()=>{
 const a={latitude:0,longitude:179.99},b={latitude:0,longitude:-179.99};
 const fix=waypointOnNd(a,b,90,10,'ARC','DATE');
 assert.ok(fix); assert.ok(fix.distanceNm<2);
 assert.ok(Math.abs(fix.relativeBearingDegrees)<1);
});
