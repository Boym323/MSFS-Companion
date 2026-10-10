import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {A320_TABS,normalizeA320Tab,selectedA320Tab,a320PanelUrl} from './a320Tabs.ts';

test('Airbus workspace has one stable deep link per instrument',()=>{
 assert.deepEqual(A320_TABS.map(x=>x.id),
  ['fcu','nd','overhead','ecam','mcdu','diagnostics']);
 assert.equal(selectedA320Tab(''),'fcu');
 assert.equal(selectedA320Tab('?panel=unknown'),'fcu');
 assert.equal(normalizeA320Tab(null),'fcu');
 assert.equal(selectedA320Tab('?panel=ecam'),'ecam');
 assert.equal(a320PanelUrl('fcu','?utm_medium=internal'),'/a320?utm_medium=internal&panel=fcu');
});
test('one instrument stage, diagnostic tools behind a separate tab',()=>{
 const src=readFileSync(new URL('./A320Dashboard.tsx',import.meta.url),'utf8');
 assert.match(src,/activeTab==='fcu'&&<A320FcuCockpit/);
 assert.match(src,/activeTab==='nd'&&<A320EfisNd/);
 assert.match(src,/activeTab==='overhead'\|\|activeTab==='ecam'/);
 assert.match(src,/activeTab==='mcdu'&&<A320McduPanel/);
 assert.match(src,/activeTab==='diagnostics'&&<section/);
 assert.match(src,/window\.history\.pushState/);
 assert.match(src,/window\.addEventListener\('popstate'/);
 assert.match(src,/aria-current=\{activeTab===tab\.id\?'page':undefined\}/);
});
test('Overhead and ECAM do not have to render concurrently',()=>{
 const src=readFileSync(new URL('./A320SystemsPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/view!=='ecam'&&<section/);
 assert.match(src,/view!=='overhead'&&<section/);
});
