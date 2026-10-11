import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validAirRadarAircraft} from './useAirRadarMapLayer.ts';
const good={hex:'49D123',callsign:'CSA123',latitude:49.2,longitude:17.8,
  altitudeFeet:25000,trackDegrees:100,distanceNm:12,seenPosSeconds:4,source:'local'};
test('C58 allows positioned fresh aircraft with bounded ICAO hex',()=>{
  assert.equal(validAirRadarAircraft([good]).length,1);
});
test('C58 rejects stale, missing or invalid positions',()=>{
  const bad=[{...good,seenPosSeconds:100},{...good,latitude:100},
    {...good,hex:'fake'}, {...good,distanceNm:-1},null];
  assert.equal(validAirRadarAircraft(bad).length,0);
});
