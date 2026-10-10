import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('./A320FcuHardware.css',import.meta.url),'utf8');
const hardware=readFileSync(new URL('./A320FcuHardware.tsx',import.meta.url),'utf8');
const dash=readFileSync(new URL('./A320Dashboard.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
test('FCU obsolete V2 controls no longer add stale CSS positions to live hardware',()=>{
 for(const selector of ['a320-hw-bay-center','a320-hw-mode-switches',
   'a320-hw-alt-main','a320-hw-alt-step-select','a320-hw-selector']){
  assert.ok(!hardware.includes(selector),'old selector unexpectedly used in live JSX: '+selector);
  assert.ok(!css.includes('.'+selector+'{'),'old standalone selector still present: '+selector);
 }
 for(const live of ['a320-hw-faceplate','a320-hw-windows',
   'a320-hw-speed-knob','a320-hw-ap1','a320-hw-vs-knob']){
  assert.ok(css.includes('.'+live),'live FCU layout missing: '+live);
 }
});
test('no internal roadmap C-codes in page eyebrow labels',()=>{
 const metas=app.match(/eyebrow:\s*'[^']+'/g)??[];
 assert.ok(metas.length>=15);
 for(const label of metas)assert.doesNotMatch(label,/\bC\d+/);
});
test('A320 diagnostics no longer claims testing is further down a long page',()=>{
 assert.match(dash,/záložce Diagnostika/);
 assert.doesNotMatch(dash,/diagnostika je níže/);
 assert.match(dash,/Number\.isFinite\(status\.fcuAgeMs\)/);
});
