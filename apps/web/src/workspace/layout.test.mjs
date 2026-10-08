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
test('výstup nikdy není prázdný', () => {
  assert.deepEqual(normalizeWorkspace({columns:9,visible:['bad']}),{columns:1,visible:['pfd','map']});
});
