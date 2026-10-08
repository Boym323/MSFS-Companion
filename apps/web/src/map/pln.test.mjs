import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorldPosition } from './pln.ts';

test('MSFS PLN DMS position accurately converts to latitude longitude', () => {
  const point = parseWorldPosition('N50° 6\' 3.41",E14° 15\' 36.84",+001245.00');
  assert.ok(point);
  assert.ok(Math.abs(point.latitude - 50.1009472) < 0.00001);
  assert.ok(Math.abs(point.longitude - 14.2602333) < 0.00001);
});
test('southern and western hemispheres are negative', () => {
  assert.deepEqual(parseWorldPosition('S12° 0\' 0",W45° 30\' 0"'),
    { latitude: -12, longitude: -45.5 });
});
test('invalid degrees and minutes are rejected', () => {
  assert.equal(parseWorldPosition('N91° 0\' 0",E14° 0\' 0"'), null);
  assert.equal(parseWorldPosition('N50° 60\' 0",E14° 0\' 0"'), null);
});
