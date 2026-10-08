import assert from 'node:assert/strict';
import test from 'node:test';
import { project, wrapTileX, shortestWorldDistance, metersBetween } from './geo.ts';

test('Mercator: souřadnice u rovníku odpovídají středu světa', () => {
  const { x, y } = project({ latitude: 0, longitude: 0 }, 2);
  assert.equal(x, 512);
  assert.equal(y, 512);
});
test('Mercator: polar and dateline coordinates are finite', () => {
  const a = project({ latitude: 89, longitude: 179.9 }, 12);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
  assert.equal(wrapTileX(-1, 3), 7);
  const b = project({ latitude: 0, longitude: -179.9 }, 12);
  const c = project({ latitude: 0, longitude: 179.9 }, 12);
  assert.ok(Math.abs(shortestWorldDistance(c.x, b.x, 12)) < 1000);
});
test('Vzdálenost zůstává v metrech', () => {
  assert.equal(metersBetween({ latitude: 50, longitude: 14 }, { latitude: 50, longitude: 14 }), 0);
  assert.ok(metersBetween({ latitude: 50, longitude: 14 }, { latitude: 51, longitude: 14 }) > 110000);
});
