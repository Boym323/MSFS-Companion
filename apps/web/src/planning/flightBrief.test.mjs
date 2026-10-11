import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeSimBriefNumber,readFlightBrief,FLIGHT_BRIEF_KEY} from './flightBrief.ts';
test('SimBrief numeric import rejects missing, negative and extreme values',()=>{
  assert.equal(safeSimBriefNumber('35000',60000),35000);
  assert.equal(safeSimBriefNumber('01.50',100),1.5);
  for(const value of ['-1','NaN','1e9','00000000','80.222',''])assert.equal(safeSimBriefNumber(value,60000),null);
  assert.equal(safeSimBriefNumber('65000',60000),null);
});
test('Flight brief never accepts expired or invalid airport codes',()=>{
  const original=globalThis.window;
  let value='';
  globalThis.window={sessionStorage:{getItem:key=>key===FLIGHT_BRIEF_KEY?value:null}};
  const b={origin:'LKPR',destination:'LOWW',alternate:null,aircraft:'A320',
    cruiseAltitudeFt:35000,plannedFuel:6000,fuelUnit:'KG',importedAt:new Date().toISOString()};
  try {
    value=JSON.stringify(b);assert.equal(readFlightBrief()?.destination,'LOWW');
    value=JSON.stringify({...b,origin:'<iframe>'});assert.equal(readFlightBrief(),null);
    value=JSON.stringify({...b,importedAt:'2020-01-01T00:00:00Z'});assert.equal(readFlightBrief(),null);
  } finally {globalThis.window=original;}
});
