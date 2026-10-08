import {test} from 'node:test';import assert from 'node:assert/strict';import {reconnectDelay} from './connectionBackoff.ts';
test('reconnect exponent a bounded maximum',()=>{assert.equal(reconnectDelay(0),1500);assert.equal(reconnectDelay(1),3000);assert.equal(reconnectDelay(2),6000);assert.equal(reconnectDelay(50),15000);assert.equal(reconnectDelay(-2),1500);});
