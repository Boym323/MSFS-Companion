import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const component=readFileSync(new URL('./CockpitControls.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('./CockpitControls.css',import.meta.url),'utf8');

test('offline commands are collapsed by default, live controls stay open',()=>{
 assert.match(component,/className="control-deck-disclosure" key=\{live\?'sim-live':'sim-offline'\} open=\{live\}/);
 assert.match(component,/Příkazy zůstanou neaktivní/);
 assert.match(component,/disabled=\{!canSend\}/);
 assert.match(component,/disabled=\{!canSendAutopilot\}/);
 assert.match(css,/\.control-deck-disclosure>summary/);
});

test('pairing and security remain available without opening controls',()=>{
 assert.ok(component.indexOf('className="control-security"') < component.indexOf('className="control-deck-disclosure"'));
 assert.match(component,/className="control-security-help"/);
 assert.match(component,/Zapnout ochranu \(párování\)/);
});
