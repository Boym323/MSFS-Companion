import test from 'node:test';
import assert from 'node:assert/strict';
import {fcuDataFresh,formatFcuValue,nextFcuReference,validateFcuReference} from './fcuUiModel.ts';
const sample={timestampUtc:'2026-10-10T11:00:00Z',selectedSpeedKnots:250,
 selectedMach:.78,selectedHeadingDegrees:90,selectedAltitudeFeet:12000,
 selectedVerticalSpeedFpm:0,autopilotMaster:false};
test('FCU reference rounding and backend allowlist bounds match',()=>{
 assert.equal(nextFcuReference('speed',250,1),251);
 assert.equal(nextFcuReference('altitude',12000,-1),11900);
 assert.equal(nextFcuReference('mach',.78,1),.79);
 assert.equal(nextFcuReference('heading',359,1),null);
 assert.equal(nextFcuReference('vs',-6000,-1),null);
 assert.equal(nextFcuReference('speed',Infinity,1),null);
 assert.equal(validateFcuReference('altitude',10555),false);
 assert.equal(validateFcuReference('mach',.785),false);
 assert.equal(validateFcuReference('heading',359),true);
});
test('FCU readback is never reused after identity or freshness changes',()=>{
 assert.equal(fcuDataFresh(true,'A320','A320',1000,sample),true);
 assert.equal(fcuDataFresh(true,'A320','B737',1000,sample),false);
 assert.equal(fcuDataFresh(true,'A320','A320',3000,sample),false);
 assert.equal(fcuDataFresh(false,'A320','A320',0,sample),false);
 assert.equal(fcuDataFresh(true,'A320','A320',-10,sample),false);
 assert.equal(fcuDataFresh(true,'A320','A320',0,{...sample,selectedSpeedKnots:NaN}),false);
});
test('No invented zero or managed status when a reference is missing',()=>{
 assert.equal(formatFcuValue('speed',undefined),'---');
 assert.equal(formatFcuValue('altitude',12000),'12,000');
 assert.equal(formatFcuValue('vs',-1000),'-1000');
 assert.equal(formatFcuValue('mach',.78),'0.78');
});
