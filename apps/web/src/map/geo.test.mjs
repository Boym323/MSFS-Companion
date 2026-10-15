import assert from 'node:assert/strict';
import test from 'node:test';
import { project, wrapTileX, shortestWorldDistance, metersBetween, relativeTrackPath, trackPathOrigin } from './geo.ts';

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

test('Stopa: relativní geometrie zůstává stejná při změně středu mapy', () => {
  const points = [
    { latitude: 50, longitude: 14 },
    { latitude: 50.001, longitude: 14.01 },
    { latitude: 50.002, longitude: 14.02 },
  ];
  const path = relativeTrackPath(points, 11);
  assert.ok(path.startsWith('M 0 0 L '));
  const atStart = project(points[0], 11);
  const origin = trackPathOrigin(points[0], atStart, 11, 920, 500);
  assert.equal(origin.x, 460);
  assert.equal(origin.y, 250);
  assert.equal(relativeTrackPath(points, 11), path);
  const moved = trackPathOrigin(points[0], project(points[2], 11), 11, 920, 500);
  assert.notDeepEqual(moved, origin);
  assert.equal(relativeTrackPath([], 11), '');
  assert.equal(relativeTrackPath([points[0]], 11), '');
});

test('Stopa: přechod přes datovou hranici neudělá čáru přes celý svět', () => {
  const points = [
    { latitude: 0, longitude: 179.99 },
    { latitude: 0, longitude: -179.99 },
  ];
  const path = relativeTrackPath(points, 11);
  const step = Number(path.match(/L ([\d.-]+)/)?.[1]);
  assert.ok(step > 0 && step < 100, `unexpected wrapped segment: ${path}`);
  const origin = trackPathOrigin(points[0], project(points[1], 11), 11, 920, 500);
  assert.ok(Math.abs(origin.x - 460) < 100);
});
