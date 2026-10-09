import test from 'node:test';
import assert from 'node:assert/strict';
import {createLogbookArchive,inspectLogbookArchive} from './logbookBackup.ts';

const makeFlight=(id='20261009T070000-abcdef012345')=>({
 summary:{id,aircraft:'C172',mode:'simconnect',startedAtUtc:'2026-10-09T07:00:00Z',
 lastAtUtc:'2026-10-09T07:01:00Z',active:false},
 samples:[{timestampUtc:'2026-10-09T07:00:00Z',aircraft:'C172',
   latitude:50.5,longitude:14.4,altitudeFeet:2500,airspeedKnots:100}],
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
