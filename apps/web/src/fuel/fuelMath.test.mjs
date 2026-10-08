import test from 'node:test';
import assert from 'node:assert/strict';
import {fuelPerformance} from './fuelMath.ts';
const series=Array.from({length:14},(_,i)=>({at:i*10000,gallons:20-i*0.055}));
test('vyžaduje dvě minuty poklesu paliva a 30min rezervu',()=>{
  const x=fuelPerformance(series,30);assert.ok(x);assert.ok(x.burnGallonsPerHour>15);
  assert.ok(x.afterReserveHours<x.enduranceHours);
});
test('nevyhodnocuje tankování, výpadek ani nulový průtok',()=>{
  assert.equal(fuelPerformance(series.slice(0,5),30),null);
  assert.equal(fuelPerformance([...series.slice(0,8),{at:80000,gallons:30}],30),null);
  assert.equal(fuelPerformance(series.map(x=>({...x,gallons:20})),30),null);
  assert.equal(fuelPerformance([...series.slice(0,8),{at:200000,gallons:19}],30),null);
});
