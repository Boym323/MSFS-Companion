import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {wasmHeartbeatLabel,wasmHeartbeatError,wasmHeartbeatTime}
 from './wasmHeartbeatPresentation.ts';

test('WASM diagnostic labels distinguish waiting, checking, available and error',()=>{
 assert.equal(wasmHeartbeatLabel('waiting_sim',false),'ČEKÁ NA MSFS');
 assert.equal(wasmHeartbeatLabel('waiting_aircraft',false),'ČEKÁ NA A320');
 assert.equal(wasmHeartbeatLabel('checking',false),'OVĚŘUJI');
 assert.equal(wasmHeartbeatLabel('connected',true),'OK');
 assert.equal(wasmHeartbeatLabel('connected',false),'OVĚŘUJI');
 assert.equal(wasmHeartbeatLabel('unavailable',false),'BEZ ODEZVY');
 assert.equal(wasmHeartbeatLabel('error',false),'CHYBA');
 assert.equal(wasmHeartbeatLabel(null,false),'NAČÍTÁM');
});
test('ACK timeout is actionable and missing timestamps are not zero or epoch',()=>{
 assert.match(wasmHeartbeatError('ack_timeout'),/Community/);
 assert.match(wasmHeartbeatError('DllNotFoundException'),/SimConnect/);
 assert.equal(wasmHeartbeatTime(null),'—');
 assert.equal(wasmHeartbeatTime('not-a-time'),'—');
});
test('FCU uses automatic heartbeat status, diagnostics and retains control safeguards',()=>{
 const src=readFileSync(new URL('./A320FcuCockpit.tsx',import.meta.url),'utf8');
 assert.match(src,/wasmHeartbeatLabel\(wasm\?\.state/);
 assert.match(src,/lastAckUtc/);
 assert.match(src,/lastProbeUtc/);
 assert.match(src,/probeIntervalSeconds/);
 assert.match(src,/autoProbe/);
 assert.match(src,/lastProtocolStatus/);
 assert.match(src,/a320\/wasm\/status/);
 assert.match(src,/a320\/wasm\/probe/);
 assert.match(src,/canMode=canSet&&wasm\?\.ready===true/);
 assert.doesNotMatch(src,/WASM \{wasm\?\.moduleReady\?'OK':'NEOVĚŘENO'/);
});
