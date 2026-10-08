import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFlight, classifyPhase } from './analysis.ts';

function point(t, opts = {}) {
  return { timestampUtc: new Date(t * 1000).toISOString(), aircraft: 'XCub',
    latitude: 50, longitude: 14, airspeedKnots: 85, altitudeFeet: 3500,
    verticalSpeedFeetPerMinute: 0, headingDegrees: 90, pitchDegrees: 0, bankDegrees: 0,
    ...opts };
}

test('bez evidence onGround nevymýšlí vzlet ani přistání', () => {
  const s = Array.from({ length: 40 }, (_, i) => point(i, { verticalSpeedFeetPerMinute: -600 }));
  const result = analyzeFlight(s);
  assert.equal(result.reliableGroundSamples, 0);
  assert.ok(result.events.every(e => e.kind !== 'touchdown' && e.kind !== 'takeoff'));
  assert.ok(result.seconds.descent > 30);
});

test('přiblížení pouze se známým AGL a onGround false', () => {
  assert.equal(classifyPhase(point(0, { onGround: false, altitudeAglFeet: 700, verticalSpeedFeetPerMinute: -500 })), 'approach');
  assert.equal(classifyPhase(point(0, { verticalSpeedFeetPerMinute: -500 })), 'descent');
});

test('potvrzený přechod onGround false→true je událost kontaktu', () => {
  const s = Array.from({ length: 8 }, (_, i) => point(i, { onGround: i >= 4, altitudeAglFeet: i >= 4 ? 0 : 250 }));
  assert.equal(analyzeFlight(s).events.filter(e => e.kind === 'touchdown').length, 1);
});

test('výpadek dlouhý 120 s nezvětší přepočítaný čas letu', () => {
  const s = [point(0), point(1), point(121), point(122)];
  assert.equal(analyzeFlight(s).seconds.level, 2);
});

test('empty data are handled safely', () => {
  const r = analyzeFlight([]);
  assert.equal(r.totalSamples, 0);
  assert.equal(r.events.length, 0);
});
