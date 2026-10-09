import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVerification,verificationKey,pilotReviewAllowed} from './verification.ts';
const now=Date.parse('2026-10-09T07:00:00Z');
test('C43 manual assessment is strictly tied to specific aircraft and known actions',()=>{
 assert.notEqual(verificationKey('C172 G1000'),verificationKey('TBM930'));
 assert.equal(verificationKey(''),null);
 assert.equal(pilotReviewAllowed(true,'ready','C172',['pfd.fpl'],'pfd.fpl'),true);
 assert.equal(pilotReviewAllowed(false,'ready','C172',['pfd.fpl'],'pfd.fpl'),false);
 assert.equal(pilotReviewAllowed(true,'unsupported','C172',['pfd.fpl'],'pfd.fpl'),false);
 assert.equal(pilotReviewAllowed(true,'ready','C172',[],'pfd.fpl'),false);
});
test('C43 discards invalid, future, stale, unlisted or forged browser data',()=>{
 const normalized=normalizeVerification({
  'pfd.fpl':{result:'pass',checkedAtUtc:'2026-10-09T06:00:00Z'},
  'pfd.softkey.13':{result:'pass',checkedAtUtc:'2026-10-09T06:00:00Z'},
  'mfd.menu':{result:'pass',checkedAtUtc:'2020-01-01T00:00:00Z'},
  '__proto__':{result:'pass',checkedAtUtc:'2026-10-09T06:00:00Z'},
  'pfd.clr':{result:'pass',checkedAtUtc:'2026-10-19T06:00:00Z'},
  'mfd.clr':{result:'bogus',checkedAtUtc:'2026-10-09T06:00:00Z'}
 },now);
 assert.deepEqual(Object.keys(normalized),['pfd.fpl']);
 assert.equal(normalized['pfd.fpl'].result,'pass');
});
