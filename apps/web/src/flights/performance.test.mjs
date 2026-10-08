import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePerformance, exportFlightCsv } from './performance.ts';
const point = (n,opts={}) => ({
  timestampUtc:new Date(n*1000).toISOString(),aircraft:'XCub',
  latitude:50,longitude:14,airspeedKnots:80,altitudeFeet:3000,
  verticalSpeedFeetPerMinute:0,headingDegrees:90,pitchDegrees:0,
  bankDegrees:10,...opts,
});
test('vzdušný čas jen ze dvou spolehlivých onGround false vzorků',() => {
  const samples=[point(0,{onGround:true}),point(1,{onGround:false}),
    point(2,{onGround:false}),point(3,{onGround:true})];
  assert.equal(analyzePerformance(samples).airborneSeconds,1);
  assert.equal(analyzePerformance(samples).averageAirborneIasKt,80);
  assert.equal(analyzePerformance([point(0)]).airborneSeconds,null);
});
test('nepřičítá přesuny mapou přes Atlantik a časové výpadky',() => {
  const samples=[point(0),point(1,{longitude:14.01}),
    point(2,{longitude:-80}),point(200,{longitude:-80.1})];
  const data=analyzePerformance(samples);
  assert.equal(data.validTrackSegments,1);
  assert.ok(data.recordedDistanceKm>0 && data.recordedDistanceKm<2);
});
test('export CSV hlavička, null, booleany a datum',()=>{
  const csv=exportFlightCsv([point(0,{onGround:false,altitudeAglFeet:null})]);
  assert.match(csv,/timestampUtc,latitude,longitude/);
  assert.match(csv,/"1970-01-01T00:00:00\.000Z"/);
  assert.ok(csv.endsWith('\r\n'));
  assert.match(csv,/,0,,/);
});

import {exportFlightGpx,exportFlightKml,validFlightPositions} from './logbookExport.ts';
test('C39 GPX/KML chrání XML a filtruje neplatnou GPS',()=>{
 const point={timestampUtc:'2026-10-08T10:00:00Z',latitude:50,longitude:14,altitudeFeet:1000};
 const invalid={...point,latitude:999};
 assert.equal(validFlightPositions([invalid,point]).length,1);
 const gpx=exportFlightGpx([invalid,point],'<C172 & test>');
 assert.match(gpx, /&lt;C172 &amp; test&gt;/);
 assert.match(gpx, /<ele>304.80<\/ele>/);
 const kml=exportFlightKml([point],'A&B'); assert.match(kml,/14,50,304.80/);
 assert.match(kml,/A&amp;B/);
 assert.throws(()=>exportFlightGpx([invalid],'none'));
});
