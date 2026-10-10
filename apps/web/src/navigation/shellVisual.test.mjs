import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const style=readFileSync(new URL('../style.css',import.meta.url),'utf8');
test('compact cockpit shell avoids duplicating the global status cards on every instrument',()=>{
 assert.match(app,/\(pathname==='\/admin'\|\|pathname==='\/'\)&&<section className="summary">/);
 assert.match(app,/\{!isA320&&<div className="intro">/);
 assert.match(app,/\(isHealth\|\|pathname==='\/admin'\|\|pathname==='\/'\)/);
});
test('top level navigation stays one horizontal accessible scrolling row on mobile',()=>{
 assert.match(style,/\.cockpit-primary-nav,\.cockpit-secondary-nav\{[\s\S]*?flex-wrap:nowrap;overflow-x:auto/);
 assert.match(style,/@media\(max-width:470px\)\{[\s\S]*?\.cockpit-primary-nav\{display:flex;grid-template-columns:none\}/);
 assert.match(style,/\.cockpit-primary-nav a,\.cockpit-secondary-nav a\{[\s\S]*?min-height:44px/);
});
test('central design tokens cover surfaces, borders, typography and spacing',()=>{
 for(const name of ['surface','surface-raised','border','text','text-muted',
  'gap-sm','gap-md','gap-lg','radius']){
  assert.ok(style.includes('--kokpit-'+name+':'),name);
 }
});
