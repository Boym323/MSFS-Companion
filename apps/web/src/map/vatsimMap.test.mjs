import test from 'node:test';
import assert from 'node:assert/strict';
import { mapQueryCoordinate, mapQueryRadiusKm, validMapPilots } from './vatsimMap.ts';

test('20Hz poloha letadla je kvantizovaná, nedělá více HTTP dotazů', () => {
  assert.equal(mapQueryCoordinate(50.1234,85.05),50.1);
  assert.equal(mapQueryCoordinate(50.12349,85.05),50.1);
  assert.equal(mapQueryCoordinate(Number.NaN,85.05),null);
  assert.equal(mapQueryCoordinate(120,85.05),null);
});
test('zoom vždy produkuje omezený VATSIM okruh', () => {
  assert.equal(mapQueryRadiusKm(10),100);
  assert.equal(mapQueryRadiusKm(6),300);
  assert.equal(mapQueryRadiusKm(15),30);
  assert.equal(mapQueryRadiusKm(Number.NaN),100);
});
test('nedůvěryhodná data nejsou předána SVG; limit 80', () => {
  const good={callsign:'OK123',latitude:50,longitude:14,heading:150,altitudeFeet:3000,groundSpeedKt:125,aircraft:'C172'};
  assert.deepEqual(validMapPilots([good,null,{...good,latitude:1000},{...good,heading:NaN}]),[good]);
  assert.equal(validMapPilots(Array.from({length:120},()=>good)).length,80);
  assert.deepEqual(validMapPilots('unexpected'),[]);
});
