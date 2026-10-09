import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationGroups, activeNavigationGroup, normalizeNavigationPath } from './navigation.ts';

const routes = [
 '/admin', '/pilot', '/validation', '/health', '/pfd', '/map', '/flight-plan',
 '/briefing', '/progress', '/fuel', '/radio-assistant', '/checklists',
 '/workspace', '/flights', '/aircraft', '/a320', '/capabilities', '/weather',
 '/vatsim', '/controls', '/g1000', '/avionics',
];

test('horní navigace obsahuje všech 22 obrazovek právě jednou', () => {
 const all = navigationGroups.flatMap(group => group.items.map(item => item.href));
 assert.deepEqual([...all].sort(), [...routes].sort());
 assert.equal(new Set(all).size, all.length);
 assert.equal(navigationGroups.length, 7);
});
test('všechny hlavní sekce odkazují na dostupnou podstránku', () => {
 for (const group of navigationGroups) {
  assert.ok(group.label);
  assert.ok(group.items.length > 0);
  assert.ok(group.items.some(item => item.href === group.href));
 }
});
test('kontextové záložky zůstávají dostupné přímo i při otevření odkazu', () => {
 assert.equal(activeNavigationGroup('/g1000').label, 'Letadlo');
 assert.equal(activeNavigationGroup('/a320').label, 'Letadlo');
 assert.equal(activeNavigationGroup('/validation').label, 'Nastavení');
 assert.equal(activeNavigationGroup('/radio-assistant').label, 'Let');
 assert.equal(activeNavigationGroup('/').label, 'Přehled');
 assert.equal(normalizeNavigationPath('/'), '/admin');
 assert.equal(activeNavigationGroup('/nonexistent').label, 'Přehled');
});
