import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PFD_LAYOUT, tapeTicks, tapeY, tapeScaleClips,
  compassMarks, compassLabel, vsNeedleY,
} from './layout.ts';

function overlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

test('Kompas ani stupnice nepřesahují vyhrazené SVG oblasti', () => {
  const { horizon, speed, altitude, vsi, compass, compassTicks, width, height } = PFD_LAYOUT;
  for (const region of [horizon, speed, altitude, vsi, compass, compassTicks]) {
    assert.ok(region.x >= 0 && region.y >= 0);
    assert.ok(region.x + region.width <= width);
    assert.ok(region.y + region.height <= height);
  }
  assert.ok(compassTicks.x >= compass.x);
  assert.ok(compassTicks.x + compassTicks.width <= compass.x + compass.width);
  assert.ok(compassTicks.y + compassTicks.height < compass.y + compass.height);
  for (const section of [speed, altitude, vsi]) {
    assert.equal(overlap(section, compass), false);
    assert.equal(overlap(section, horizon), false);
  }
  assert.equal(overlap(horizon, compass), false);
});

test('IAS při 0 KT má právě jednu nulu, ostatní značky se neopakují', () => {
  const ticks = tapeTicks(0, 10, 8, 0);
  assert.equal(ticks.filter((t) => t === 0).length, 1);
  assert.deepEqual(ticks.slice(0, 5), [0, 10, 20, 30, 40]);
  assert.equal(new Set(ticks).size, ticks.length);
  assert.ok(tapeTicks(-100, 10, 8, 0).length === 0);
});

test('Maska stupnic nikdy nepřekrývá pevný ukazatel', () => {
  for (const region of [PFD_LAYOUT.speed, PFD_LAYOUT.altitude]) {
    const [top, bottom] = tapeScaleClips(region);
    assert.ok(top.y + top.height <= PFD_LAYOUT.pointerTop);
    assert.ok(bottom.y >= PFD_LAYOUT.pointerBottom);
    assert.ok(top.x === region.x && bottom.x === region.x);
  }
  assert.equal(tapeY(1100, 1168, 0.49) > PFD_LAYOUT.centerY, true);
});

test('Kompas: sever přes 359/0 bez skoku a značky jsou ořezány', () => {
  const nearNorth = compassMarks(359);
  assert.ok(nearNorth.some((m) => m.value === 0 && m.x > PFD_LAYOUT.centerX));
  assert.ok(compassMarks(1).some((m) => m.value === 0 && m.x < PFD_LAYOUT.centerX));
  assert.equal(compassLabel(0), 'S');
  assert.equal(compassLabel(90), 'V');
  assert.equal(compassLabel(180), 'J');
  assert.equal(compassLabel(270), 'Z');
  assert.ok(nearNorth.some((m) => m.x < PFD_LAYOUT.compassTicks.x));
});

test('VSI má nulovou polohu uprostřed a omezený rozsah při extrémech', () => {
  assert.equal(vsNeedleY(0), PFD_LAYOUT.centerY);
  assert.ok(vsNeedleY(1000) < PFD_LAYOUT.centerY);
  assert.ok(vsNeedleY(-1000) > PFD_LAYOUT.centerY);
  assert.equal(vsNeedleY(9999), vsNeedleY(3000));
  assert.equal(vsNeedleY(-9999), vsNeedleY(-3000));
  assert.ok(vsNeedleY(3000) > PFD_LAYOUT.vsi.y);
  assert.ok(vsNeedleY(-3000) < PFD_LAYOUT.vsi.y + PFD_LAYOUT.vsi.height);
});

test('SVG PFD skutečně používá deklarované clipPath a nemá staré překrývající popisky', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync(new URL('./Pfd.tsx', import.meta.url), 'utf8');
  for (const id of ['pfd-horizon', 'pfd-speed-scale', 'pfd-altitude-scale',
    'pfd-vsi-scale', 'pfd-compass-scale']) {
    assert.ok(source.includes('id="' + id + '"'), 'Chybí clipPath ' + id);
    assert.ok(source.includes('clipPath="url(#' + id + ')"'), 'ClipPath není použit ' + id);
  }
  assert.ok(!source.includes('VÝŠKA · RYCHLOST'));
  assert.ok(source.includes('vsiTicks.map'), 'Chybí skutečná VSI stupnice');
  assert.ok(source.includes('pfd-readouts'), 'Doplňující texty musí být mimo kompas');
});
