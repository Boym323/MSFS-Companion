import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogbookArchive,inspectLogbookArchive} from './logbookBackup.ts';

const makeFlight=(id='20261009T070000-abcdef012345')=>({
 summary:{id,aircraft:'C172',mode:'simconnect',startedAtUtc:'2026-10-09T07:00:00Z',
 lastAtUtc:'2026-10-09T07:01:00Z',endedAtUtc:'2026-10-09T07:01:00Z',active:false},
 samples:[{timestampUtc:'2026-10-09T07:00:00Z',aircraft:'C172',
   latitude:50.5,longitude:14.4,altitudeFeet:2500,airspeedKnots:100,
   verticalSpeedFeetPerMinute:0,headingDegrees:90,pitchDegrees:0,bankDegrees:0}],
});
test('C49 archive preserves valid own positions and rejects active incomplete sessions',()=>{
 const text=createLogbookArchive([makeFlight()], '2026-10-09T07:10:00Z');
 assert.equal(inspectLogbookArchive(text).count,1);
 assert.equal(inspectLogbookArchive(text).samples,1);
 assert.equal(JSON.parse(text).flights[0].samples[0].longitude,14.4);
 const active=makeFlight();active.summary.active=true;
 assert.throws(()=>createLogbookArchive([active],
  '2026-10-09T07:10:00Z'),/Aktivní let/);
});
test('C49 rejects corrupted backups, duplicate flights and invalid coordinates',()=>{
 const a=makeFlight();
 assert.throws(()=>createLogbookArchive([a,a], '2026-10-09T07:10:00Z'),/duplicitní/);
 assert.throws(()=>inspectLogbookArchive('{}'),/schéma|formát/);
 assert.throws(()=>inspectLogbookArchive('not json'),/JSON/);
 const bad=makeFlight();bad.samples[0].longitude=999;
 assert.throws(()=>createLogbookArchive([bad],'2026-10-09T07:10:00Z'),/neplatné/);
});
test('C49 rejects overly large and unexpected schema payloads',()=>{
 assert.throws(()=>inspectLogbookArchive('x'.repeat(20_000_001)),/velký/);
 assert.throws(()=>inspectLogbookArchive(JSON.stringify({schema:'unknown',flights:[]})),/schéma/);
});

test('C49 browser and recorder require at most 4000 samples per flight',()=>{
  const archive=makeFlight();
  archive.samples=Array.from({length:4001},(_,i)=>({
    ...archive.samples[0],timestampUtc:new Date(
      Date.parse('2026-10-09T07:00:00Z')+i*10).toISOString()
  }));
  assert.throws(()=>createLogbookArchive([archive],'2026-10-09T07:10:00Z'),/neplatné/);
  const payload=JSON.stringify({schema:'kokpit-flight-backup-v1',
    exportedAtUtc:'2026-10-09T07:10:00Z',flights:[archive]});
  assert.throws(()=>inspectLogbookArchive(payload),/neplatné/);
});
test('C49 validates mandatory SimConnect samples and monotonic timestamps',()=>{
  const missing=makeFlight();delete missing.samples[0].bankDegrees;
  assert.throws(()=>createLogbookArchive([missing],'2026-10-09T07:10:00Z'),/neplatné/);
  const unsorted=makeFlight();unsorted.samples=[
    {...unsorted.samples[0],timestampUtc:'2026-10-09T07:00:05Z'},
    {...unsorted.samples[0],timestampUtc:'2026-10-09T07:00:04Z'}
  ];
  assert.throws(()=>createLogbookArchive([unsorted],'2026-10-09T07:10:00Z'),/neplatné/);
  const wrongAircraft=makeFlight();wrongAircraft.samples[0].aircraft='TBM930';
  assert.throws(()=>createLogbookArchive([wrongAircraft],
    '2026-10-09T07:10:00Z'),/neplatné/);
  const wrongId=makeFlight('not-a-recorder-id');
  assert.throws(()=>createLogbookArchive([wrongId],
    '2026-10-09T07:10:00Z'),/neplatné/);
});
test('C49 validates sample boundaries and rejected empty/missing sessions',()=>{
  const empty=makeFlight();empty.samples=[];
  assert.throws(()=>createLogbookArchive([empty],'2026-10-09T07:10:00Z'),/neplatné/);
  const badAltitude=makeFlight();badAltitude.samples[0].altitudeFeet=200000;
  assert.throws(()=>createLogbookArchive([badAltitude],
    '2026-10-09T07:10:00Z'),/neplatné/);
  const late=makeFlight();late.samples[0].timestampUtc='2026-10-09T08:30:00Z';
  assert.throws(()=>createLogbookArchive([late],
    '2026-10-09T07:10:00Z'),/neplatné/);
});
