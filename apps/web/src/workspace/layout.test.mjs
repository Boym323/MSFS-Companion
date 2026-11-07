import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkspace } from './layout.ts';

test('prázdná data obnoví PFD a mapu', () => {
  assert.deepEqual(normalizeWorkspace(null), {columns:1, visible:['pfd','map']});
});
test('neplatné a duplicitní panely se ignorují', () => {
  assert.deepEqual(normalizeWorkspace({ columns:2, visible:['pfd','map','map','evil','controls','aircraft'] }),
    { columns:2, visible:['pfd','map','controls'] });
});
test('uložené Garmin panely se odfiltrují bez ztráty ostatních voleb', () => {
  assert.deepEqual(normalizeWorkspace({columns:2,visible:['g1000','avionics','pfd','map']}),
    {columns:2,visible:['pfd','map']});
  assert.deepEqual(normalizeWorkspace({columns:1,visible:['g1000']}),
    {columns:1,visible:['pfd','map']});
});
test('starý Asobo panel se odfiltruje a ostatní panely zůstanou',()=>{
  assert.deepEqual(normalizeWorkspace({columns:2,visible:['a320','g1000','map','pfd']}),{columns:2,visible:['map','pfd']});
  assert.deepEqual(normalizeWorkspace({columns:1,visible:['a320']}),{columns:1,visible:['pfd','map']});
});
test('výstup nikdy není prázdný', () => {
  assert.deepEqual(normalizeWorkspace({columns:9,visible:['bad']}),{columns:1,visible:['pfd','map']});
});
