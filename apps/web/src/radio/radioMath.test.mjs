import test from 'node:test';import assert from 'node:assert/strict';
import {allowedComStandby,comFrequencies} from './radioMath.ts';
test('ICOM tuning is same whitelist spacing as bridge',()=>{
 assert.equal(allowedComStandby(118.5),118500000);
 assert.equal(allowedComStandby(136.99),136990000);
 assert.equal(allowedComStandby(117.99),null);
 assert.equal(allowedComStandby(118.002),null);
 assert.equal(allowedComStandby(Infinity),null);
});
test('filters invalid or unrepresentable airports data',()=>{
 assert.deepEqual(comFrequencies([{type:'TWR',description:'',frequencyMhz:118.5},
 {type:'TWR',description:'',frequencyMhz:88.5}]).map(x=>x.frequencyMhz),[118.5]);
});
