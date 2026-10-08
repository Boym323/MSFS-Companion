import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHeading,
  shortestAngleDifference,
  blend,
  blendAngle,
  pitchUpFromSimConnect,
  bankHorizonRotation,
} from './math.ts';

test('PFD: převod pitch a bank podle ověřené konvence MSFS 2020', () => {
  assert.equal(pitchUpFromSimConnect(10), -10);
  assert.equal(pitchUpFromSimConnect(-7), 7);
  assert.equal(bankHorizonRotation(30), 30);
  assert.equal(bankHorizonRotation(-30), -30);
});

test('PFD: kurz bez přeskoku při průchodu severem', () => {
  assert.equal(shortestAngleDifference(359, 1), 2);
  assert.equal(shortestAngleDifference(1, 359), -2);
  assert.equal(normalizeHeading(-5), 355);
  assert.equal(normalizeHeading(365), 5);
  const result = blendAngle(359, 1, 50);
  assert.ok(result >= 359 || result <= 1);
});

test('PFD: vyhlazování se nepokouší extrapolovat neexistující vzorky', () => {
  assert.equal(blend(10, 20, 0), 10);
  assert.ok(blend(10, 20, 16) > 10 && blend(10, 20, 16) < 20);
  assert.ok(blend(10, 20, 1000) < 20);
});
