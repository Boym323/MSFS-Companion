import test from 'node:test';
import assert from 'node:assert/strict';
import {aircraftSystemLabel,cockpitSystemsFresh,latestValue,
 systemNumber} from './systemsReadback.ts';
const data={timestampUtc:'2026-10-10T12:00:00Z',landing:true,taxi:false,
 nav:true,beacon:false,strobe:false,pitot:true,parkingBrake:false};
test('Overhead readback is never reused after aircraft identity switch',()=>{
 const status={connected:true,sampleAgeMs:500,systems:data};
 assert.equal(cockpitSystemsFresh(status,'A320','A320',true),true);
 assert.equal(cockpitSystemsFresh(status,'A320','A321',true),false);
 assert.equal(cockpitSystemsFresh(status,'A320','A320',false),false);
 assert.equal(cockpitSystemsFresh({...status,connected:false},'A320','A320',true),false);
});
test('stale and missing data are UNKNOWN rather than fabricated OFF',()=>{
 const status={connected:true,sampleAgeMs:6000,systems:data};
 assert.equal(cockpitSystemsFresh(status,'A320','A320',true),false);
 assert.equal(cockpitSystemsFresh({...status,sampleAgeMs:-1},'A320','A320',true),false);
 assert.equal(cockpitSystemsFresh({...status,sampleAgeMs:NaN},'A320','A320',true),false);
 assert.equal(cockpitSystemsFresh({...status,sampleAgeMs:500,systems:null},'A320','A320',true),false);
 assert.equal(aircraftSystemLabel(undefined),'—');
 assert.equal(aircraftSystemLabel(false),'OFF');
 assert.equal(aircraftSystemLabel(true),'ON');
});
test('ECAM generic engine/APU readback is separately gated by age',()=>{
 const snapshot={n1Engine1:34.5};
 assert.equal(latestValue(snapshot,5900),snapshot);
 assert.equal(latestValue(snapshot,6000),null);
 assert.equal(latestValue(snapshot,-1),null);
 assert.equal(latestValue(snapshot,null),null);
 assert.equal(systemNumber(null),'—');
 assert.equal(systemNumber(NaN),'—');
 assert.equal(systemNumber(34.55,1),'34.5');
});
