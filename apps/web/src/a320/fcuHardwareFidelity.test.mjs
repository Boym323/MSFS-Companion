import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const tsx=readFileSync(new URL('./A320FcuHardware.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./A320FcuHardware.css',import.meta.url),'utf8');
const cockpit=readFileSync(new URL('./A320FcuCockpit.tsx',import.meta.url),'utf8');

test('A320 physical FCU has four rotary controls and a SINGLE central mode button',()=>{
 assert.match(tsx,/a320-hw-speed-knob/);
 assert.match(tsx,/a320-hw-heading-knob/);
 assert.match(tsx,/a320-hw-altitude-knob/);
 assert.match(tsx,/a320-hw-vs-knob/);
 assert.equal((tsx.match(/a320-hw-central-mode/g)||[]).length,1);
 assert.match(tsx,/<RoundPush label="HDG V\/S – TRK FPA"\/>/);
 assert.doesNotMatch(tsx,/a320-hw-mode-switches/);
});

test('hardware keys remain unmapped and cannot transmit unverified AP events',()=>{
 for(const name of ['AP1','AP2','A/THR','LOC','EXPED','APPR']){
  assert.ok(tsx.includes('<PushButton>'+name+'</PushButton>'));
 }
 assert.match(tsx,/function PushButton[\s\S]*?<button type="button" disabled /);
 assert.match(cockpit,/canMode=\{canMode\}/);
 assert.match(cockpit,/onMode=\{sendMode\}/);
});

test('web-specific inputs and synthetic 1000-foot stepping never contaminate fascia',()=>{
 assert.match(tsx,/<details className="a320-hw-service">/);
 assert.match(tsx,/<\/details>/);
 assert.match(tsx,/a320-hw-quick-settings/);
 assert.match(css,/\.a320-hw-service:not\(\[open\]\)>\.a320-hw-dock\{display:none\}/);
 assert.doesNotMatch(tsx,/a320-hw-tiny-step/);
 assert.match(tsx,/onPointerUp=\{e=>/);
 assert.match(tsx,/onKeyDown=\{e=>/);
});

test('slate faceplate and four-window geometry retain aircraft proportions',()=>{
 assert.match(css,/\.a320-hw-faceplate\{[\s\S]*?width:1200px;min-width:1200px;height:400px/);
 for(const selector of ['a320-hw-window-speed','a320-hw-window-heading',
    'a320-hw-window-altitude','a320-hw-window-vs',
    'a320-hw-ap1','a320-hw-ap2','a320-hw-athr','a320-hw-loc',
    'a320-hw-metric','a320-hw-exped','a320-hw-appr']){
  assert.ok(css.includes('.'+selector),selector);
 }
 assert.match(css,/\.a320-hw-scroll\{[\s\S]*?overflow-x:auto/);
});
