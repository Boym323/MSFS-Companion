import test from 'node:test';import assert from 'node:assert/strict';
import {downsampleSeries,seriesPath} from './chartMath.ts';
test('bounded large chart and stable last cursor sample',()=>{
 const values=Array.from({length:25000},(_,i)=>Math.sin(i/100));
 const result=downsampleSeries(values);
 assert.ok(result.length<=601);
 assert.equal(result.at(-1)?.index,24999);
 assert.ok(seriesPath(values).startsWith('M '));
});
test('missing and invalid series render no fictitious data',()=>{
 assert.equal(seriesPath([]),'');
 assert.equal(seriesPath([Number.NaN,Infinity]),'');
 assert.equal(downsampleSeries([Infinity,3]).length,1);
});
