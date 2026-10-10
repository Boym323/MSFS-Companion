import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const data=(file)=>readFileSync(new URL(file,import.meta.url),'utf8');
test('three airplane tools use the same source-aware section header',()=>{
 const components=['./A320EfisNd.tsx','./A320SystemsPanel.tsx','./A320McduPanel.tsx'];
 for(const c of components){
  const s=data(c);
  assert.match(s,/import A320SectionHeader/);
  assert.match(s,/<A320SectionHeader/);
 }
 const head=data('./A320SectionHeader.tsx');
 assert.match(head,/role="status"/);
 assert.match(head,/a320-module-header/);
});
test('MCDU unverified keypad stays disabled and behind disclosure',()=>{
 const s=data('./A320McduPanel.tsx');
 assert.match(s,/<details className="a320-mcdu-keyboard-details">/);
 assert.match(s,/disabled>\{key\}<\/button>/);
 assert.doesNotMatch(s,/method:\s*['"]POST['"]/);
});
test('responsive shell retains 44px touches and hardware scroll without clipping body',()=>{
 const css=data('./A320Experience.css');
 assert.match(css,/@media\(max-width:600px\)/);
 assert.match(css,/@media\(max-width:390px\)/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/\.a320-instrument-stage \.a320-efis-controls\{order:2\}/);
 const dashboard=data('./A320Dashboard.tsx');
 assert.match(dashboard,/import '\.\/A320Experience\.css'/);
});
