import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOpenAir} from './openAir.ts';
import {metersBetween} from './geo.ts';

test('C45 full OpenAir DC circle is bounded and radius in nautical miles',()=>{
 const {regions,skipped}=parseOpenAir('AC D\nAN Test\nV X=50:00.000N 014:00.000E\nDC 2.5');
 assert.equal(skipped,0);
 assert.equal(regions.length,1);
 assert.equal(regions[0].points.length,72);
 const first=regions[0].points[0];
 assert.ok(Math.abs(metersBetween(first,{latitude:50,longitude:14})/1852-2.5)<0.02);
});
test('C45 DA small clockwise and counter-clockwise arcs produce short segments',()=>{
 const first='AC R\nV X=50:00:00 N 014:00:00 E\nDA 2,350,10\nDP 50:01:00 N 014:00:00 E';
 const second='AC R\nV X=50:00:00 N 014:00:00 E\nV D=-\nDA 2,10,350\nDP 50:01:00 N 014:00:00 E';
 const {regions,skipped}=parseOpenAir(first+'\n'+second);
 assert.equal(skipped,0);
 assert.equal(regions.length,2);
 assert.equal(regions[0].points.length,6);
 assert.equal(regions[1].points.length,6);
 assert.ok(regions[0].points.every(p=>p.latitude>49.9&&p.latitude<50.1));
});
test('C45 DB uses documented center and equal-radius endpoints',()=>{
 const data='AC D\nV X=50:00:00 N 014:00:00 E\nDB 50:01:00 N 014:00:00 E, 50:00:00 N 014:01:33 E\nDP 50:00:00 N 014:00:00 E';
 const {regions,skipped}=parseOpenAir(data);
 assert.equal(skipped,0);
 assert.equal(regions.length,1);
 assert.ok(regions[0].points.length>4);
 assert.ok(metersBetween(regions[0].points[0],{latitude:50+1/60,longitude:14})<30);
});
test('C45 never draws malformed arcs, missing centers or unsupported radii',()=>{
 const data=[
 'AC D\nDA 2,0,90\nDP 50:00:00 N 014:00:00 E',
 'AC D\nV X=50:00:00 N 014:00:00 E\nDC 500',
 'AC D\nV X=50:00:00 N 014:00:00 E\nDB 50:01:00 N 014:00:00 E, 51:00:00 N 014:00:00 E',
 'AC D\nDP 50:00:00 N 014:00:00 E\nDP 50:00:00 N 014:00:00 E\nDP 50:00:00 N 014:00:00 E',
 ];
 const result=parseOpenAir(data.join('\n'));
 assert.equal(result.regions.length,0);
 assert.equal(result.skipped,4);
});
test('C45 legacy simple polygon still renders; dateline longitudes are finite',()=>{
 const area='AC D\nDP 50:00:00 N 014:00:00 E\nDP 50:01:00 N 014:00:00 E\nDP 50:00:00 N 014:01:00 E';
 assert.equal(parseOpenAir(area).regions.length,1);
 const near180=parseOpenAir('AC D\nV X=00:00:00 N 179:59:00 E\nDC 3');
 assert.equal(near180.regions.length,1);
 assert.ok(near180.regions[0].points.every(p=>Math.abs(p.longitude)<=180));
});
