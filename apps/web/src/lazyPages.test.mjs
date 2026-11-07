import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('./App.tsx',import.meta.url),'utf8');
test('heavy route components are dynamic imports, not eager dependencies',()=>{
  for(const [name,path] of [
    ['MovingMap','./map/MovingMap'],['Pfd','./pfd/Pfd'],
    ['CockpitWorkspace','./workspace/CockpitWorkspace'],
    ['PilotAssistant','./assistant/PilotAssistant'],
    ['FlightHistory','./flights/FlightHistory']
  ]){
    assert.ok(code.includes("const "+name+"=memo(lazy(()=>import('"+path+"')))"),name);
    assert.ok(!code.includes('import '+name+' from'),name+' still eager');
  }
});
test('deleted Asobo V1 dynamic import must never reappear',()=>{
  assert.ok(!code.includes("a320/A320Dashboard"));
  assert.ok(code.includes("Původní Asobo A320 V1 a WASM byly vyřazeny"));
});
test('collapsed updater is not mounted or polled',()=>{
  assert.match(code,/maintenanceOpen&&<Suspense/);
  assert.match(code,/onToggle=\{event=>setMaintenanceOpen\(event.currentTarget.open\)\}/);
});
test('lazy views provide a screen-reader loading message and Suspense boundary',()=>{
  assert.match(code,/<Suspense fallback=\{<p className="page-loading" role="status">/);
  assert.match(code,/<\/Suspense>/);
});
