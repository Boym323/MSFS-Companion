import test from 'node:test';
import assert from 'node:assert/strict';
import {relativeTraffic} from './relativeTraffic.ts';

const own={latitude:50,longitude:14,altitudeFeet:6000,headingDegrees:0};
const mk=(id,lat,lon,alt=6000)=>({objectId:id,latitude:lat,longitude:lon,
  altitudeFeet:alt,headingDegrees:0,groundSpeedKnots:150,onGround:false});
test('C46 relative north/east and vertical offsets use actual positions',()=>{
  const result=relativeTraffic(own,[mk(10,50.1,14,7000),mk(20,50,14.1,4500)]);
  assert.equal(result.length,2);
  assert.equal(result[0].objectId,20);
  assert.equal(result[0].side,'vpravo');
  assert.equal(result[0].altitudeDifferenceFeet,-1500);
  assert.equal(result[1].side,'vpředu');
  assert.equal(result[1].altitudeDifferenceFeet,1000);
});
test('C46 removes invalid and extremely distant traffic',()=>{
 const res=relativeTraffic(own,[mk(0,50.1,14),mk(1,0,0),mk(2,50,14),
   mk(3,50.1,Infinity),mk(4,50.02,14)]);
 assert.deepEqual(res.map(x=>x.objectId),[4]);
 assert.deepEqual(relativeTraffic(null,[mk(4,50.02,14)]),[]);
});
test('C46 wraps international date line and rejects self proximity',()=>{
 const here={latitude:0,longitude:179.99,altitudeFeet:5000,headingDegrees:90};
 const result=relativeTraffic(here,[mk(7,0,-179.99)]);
 assert.equal(result.length,1);
 assert.equal(result[0].side,'vpředu');
 assert.ok(result[0].distanceNm<3);
});
