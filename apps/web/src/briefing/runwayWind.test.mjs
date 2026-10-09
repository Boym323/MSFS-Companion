import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMetarWind,calculateRunwayWind,freshMetarWind} from './runwayWind.ts';
const runways=[{lowIdent:'36',highIdent:'18',latitude:50,longitude:14,
  endLatitude:50.01,endLongitude:14,lengthFeet:3000,surface:'ASP'}];

test('C47 true geometry: headwind, tailwind, and both runway directions',()=>{
 const wind=parseMetarWind('METAR LKPR 090630Z 36010G18KT CAVOK 11/06 Q1022','LKPR');
 assert.equal(wind?.direction,0);
 const [north,south]=calculateRunwayWind(runways,wind);
 assert.equal(north.ident,'36');
 assert.equal(north.headwindKnots,10);
 assert.equal(north.gustHeadwindKnots,18);
 assert.equal(south.ident,'18');
 assert.equal(south.headwindKnots,-10);
 assert.equal(north.crosswindKnots,0);
});
test('C47 does not invent a direction in VRB reports; calm is 0',()=>{
 const vrb=parseMetarWind('LKPR 090630Z VRB05KT CAVOK','LKPR');
 assert.equal(vrb?.direction,null);
 assert.equal(calculateRunwayWind(runways,vrb).length,0);
 const calm=parseMetarWind('LKPR 090630Z 00000KT CAVOK','LKPR');
 assert.equal(calm?.calm,true);
 assert.equal(calculateRunwayWind(runways,calm)[0].headwindKnots,0);
});
test('C47 rejects wrong airport, invalid/corrupt wind and stale feeds',()=>{
 assert.equal(parseMetarWind('LKTB 090630Z 36010KT','LKPR'),null);
 assert.equal(parseMetarWind('LKPR 090630Z 00015KT','LKPR'),null);
 assert.equal(parseMetarWind('LKPR 090630Z 40015KT','LKPR'),null);
 assert.equal(parseMetarWind('LKPR 090630Z 15010G06KT','LKPR'),null);
 const now=Date.parse('2026-10-09T06:40:00Z');
 const raw='LKPR 090630Z 18008KT CAVOK';
 assert.equal(freshMetarWind(raw,'LKPR','2026-10-09T03:00:00Z',true,false,now),null);
 assert.equal(freshMetarWind(raw,'LKPR','2026-10-09T06:39:00Z',true,true,now),null);
 assert.ok(freshMetarWind(raw,'LKPR','2026-10-09T06:39:00Z',true,false,now));
});
test('C47 requires actual runway endpoints, not runway numbers alone',()=>{
 const wind=parseMetarWind('LKPR 090630Z 18008KT','LKPR');
 assert.deepEqual(calculateRunwayWind([{lowIdent:'18',highIdent:'36'}],wind),[]);
});
