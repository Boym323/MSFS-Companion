import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendedAircraftLayout,aircraftLayoutStorageKey} from './aircraftPresets.ts';
import {normalizeWorkspace} from './layout.ts';

test('C50 maps common aircraft to explicit candidate layouts',()=>{
 assert.deepEqual(recommendedAircraftLayout('Cessna 172 Skyhawk')?.layout.visible,
 ['pfd','map','g1000']);
 assert.deepEqual(recommendedAircraftLayout('TBM930')?.layout.visible,
 ['pfd','map','avionics']);
 assert.deepEqual(recommendedAircraftLayout('XCub Floats')?.layout.visible,
 ['pfd','map','aircraft']);
 assert.deepEqual(recommendedAircraftLayout('Unknown plane')?.layout.visible,
 ['pfd','map']);
});
test('C50 storage keys are bounded and per actual aircraft title',()=>{
 assert.equal(aircraftLayoutStorageKey(''),null);
 assert.equal(aircraftLayoutStorageKey('x'.repeat(101)),null);
 assert.notEqual(aircraftLayoutStorageKey('C172 A'),aircraftLayoutStorageKey('C172 B'));
 assert.equal(recommendedAircraftLayout('A\nB'),null);
});
test('C50 loaded layouts are normalized against enabled panel set',()=>{
 const bad=normalizeWorkspace({columns:4,visible:['junk','pfd','pfd','map','controls','g1000']});
 assert.equal(bad.columns,1);
 assert.deepEqual(bad.visible,['pfd','map','controls']);
});
