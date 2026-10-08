import { test } from 'node:test';
import assert from 'node:assert/strict';
import {readPhaseEvidence} from './systemsPhase.ts';
const now=Date.parse('2026-10-08T18:00:05Z');
const frame={connected:true,sampleAgeMs:1000,systems:{
  timestampUtc:'2026-10-08T18:00:04Z',mode:'simconnect',
  onGround:false,altitudeAglFeet:500
}};
test('C38 používá živý 1Hz onGround a AGL readback',()=>{
 const value=readPhaseEvidence(frame,'C172',now);
 assert.equal(value?.aircraft,'C172');
 assert.equal(value?.onGround,false);
 assert.equal(value?.altitudeAglFeet,500);
});
test('C38 odmítá starý, testovací a nepodložený stav',()=>{
 assert.equal(readPhaseEvidence({...frame,connected:false},'C172',now),null);
 assert.equal(readPhaseEvidence({...frame,sampleAgeMs:7000},'C172',now),null);
 assert.equal(readPhaseEvidence({...frame,systems:{...frame.systems,mode:'mock'}},'C172',now),null);
 assert.equal(readPhaseEvidence({...frame,systems:{...frame.systems,onGround:null}},'C172',now),null);
 assert.equal(readPhaseEvidence(frame,'',now),null);
 assert.equal(readPhaseEvidence({...frame,systems:{...frame.systems,altitudeAglFeet:-123}},'C172',now)?.altitudeAglFeet,null);
});
