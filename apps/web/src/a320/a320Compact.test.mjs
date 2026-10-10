import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const workspace=readFileSync(new URL('../workspace/CockpitWorkspace.tsx',import.meta.url),'utf8');
const dash=readFileSync(new URL('./A320Dashboard.tsx',import.meta.url),'utf8');
const compact=readFileSync(new URL('./A320CompactStatus.tsx',import.meta.url),'utf8');
test('workspace no longer mounts all six Airbus instruments into a small tile',()=>{
 assert.match(workspace,/if \(id === 'a320'\) return <A320CompactStatus/);
 assert.doesNotMatch(workspace,/import A320Dashboard from/);
 assert.doesNotMatch(compact,/fetch\(/);
 assert.doesNotMatch(compact,/<A320FcuCockpit|<A320SystemsPanel|<A320McduPanel/);
});
test('only current FCU cockpit hosts commands; legacy surfaces not duplicated',()=>{
 assert.doesNotMatch(dash,/<A320FcuControlPanel/);
 assert.doesNotMatch(dash,/<A320HEventsPanel/);
 assert.match(dash,/activeTab==='fcu'&&<A320FcuCockpit/);
});
test('workspace can link directly to each Airbus instrument',()=>{
 assert.match(compact,/A320_TABS/);
 assert.match(compact,/a320PanelUrl\(tab.id\)/);
 assert.match(compact,/aria-label="Otevřít přístroj Airbus"/);
});
