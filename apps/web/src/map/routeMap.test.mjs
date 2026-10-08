import assert from 'node:assert/strict';
import test from 'node:test';
import { fitRoute, pointOnRouteMap } from './routeMap.ts';
import { project, visibleTiles } from './geo.ts';

test('trasa nad Prahou se vejde do mapy i na mobilu', () => {
  const points = [{ latitude: 50.1, longitude: 14.3 }, { latitude: 50.2, longitude: 14.6 }];
  for (const width of [320, 620, 920]) {
    const view = fitRoute(points, width, 330);
    assert.ok(view);
    for (const point of points) {
      const p = pointOnRouteMap(point, view, width, 330);
      assert.ok(p && p.x >= 20 && p.x <= width - 20 && p.y >= 20 && p.y <= 310);
    }
  }
});

test('přelet 179.8° až -179.8° nedělá celosvětový oblouk', () => {
  const points = [{ latitude: 10, longitude: 179.8 }, { latitude: 10.1, longitude: -179.8 }];
  const view = fitRoute(points, 620, 320);
  const a = pointOnRouteMap(points[0], view, 620, 320);
  const b = pointOnRouteMap(points[1], view, 620, 320);
  assert.ok(a && b && Math.abs(b.x - a.x) < 570);
  assert.ok(view.zoom > 2);
});

test('neplatná/žádná GPS vrací prázdnou mapu, nikoli nesmyslný podklad', () => {
  assert.equal(fitRoute([], 620, 330), null);
  assert.equal(fitRoute([{ latitude: 91, longitude: 14 }], 620, 330), null);
});

test('dlaždice odpovídají projekci a zůstávají jen ve viditelném výřezu', () => {
  const center = project({ latitude: 50.087, longitude: 14.42 }, 12);
  const tiles = visibleTiles(center, 12, 620, 330);
  assert.ok(tiles.length > 0 && tiles.length < 25);
  assert.ok(tiles.every(t => t.url.startsWith('https://tile.openstreetmap.org/12/')));
  assert.ok(tiles.every(t => t.left > -256 && t.left < 620 && t.top > -256 && t.top < 330));
  assert.deepEqual(visibleTiles(center, 12, 100000, 100000), []);
});
