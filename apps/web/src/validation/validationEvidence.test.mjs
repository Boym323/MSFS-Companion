import test from 'node:test';
import assert from 'node:assert/strict';
import { buildValidationEvidence } from './validationEvidence.ts';
import { compareEvidence } from './compareEvidence.ts';

test('C31 evidence is a strict allowlist without position, credentials or raw errors', () => {
  const evidence = buildValidationEvidence(
    { mode: 'simconnect', connected: true, connectionState: 'connected',
      sampleAgeMs: 500, sampleRateHz: 20, incomingRateHz: 29.5, samplesReceived: 10,
      latitude: 50.1001, longitude: 14.3002, lastError: 'secret-private-path' },
    { connected: true, sampleAgeMs: 300, systems: {
      mode: 'simconnect', onGround: false, altitudeAglFeet: 1999, trueAirspeedKnots: 110.5,
      engineRpm: 2200, fuelGallons: 29, latitude: 50.1, token: 'secret-token',
    }},
    { connected: true, sampleAgeMs: 50, navigation: {
      flightPlanActive: true, waypointActive: true, waypointCount: 4,
      waypointIndex: 2, distanceNauticalMiles: 33,
      nextWaypoint: { latitude: 50.999, longitude: 14.999 },
      crossTrackNauticalMiles: 0.1, auth: 'secret-nav',
    }},
    '2026-10-08T20:00:00Z',
  );
  assert.equal(evidence.telemetry.live, true);
  assert.equal(evidence.systems.engineRpm, 2200);
  assert.equal(evidence.navigation.waypointCount, 4);
  const report = JSON.stringify(evidence);
  assert.ok(!report.includes('latitude') && !report.includes('longitude'));
  assert.ok(!report.includes('secret-'));
  assert.ok(!report.includes('nextWaypoint'));
});

test('C31 refuses stale/offline/mock data and discards invalid measurements', () => {
  const snap = buildValidationEvidence(
    { mode: 'mock', connected: true, sampleRateHz: Infinity,
      samplesReceived: -1, connectionState: 'unknown' },
    { connected: true, systems: { onGround: true, fuelGallons: 50 }},
    { connected: true, navigation: { waypointCount: 3 }},
    '2026-10-08T20:00:00Z',
  );
  assert.equal(snap.telemetry.live, false);
  assert.equal(snap.telemetry.sampleRateHz, null);
  assert.equal(snap.telemetry.samplesReceived, null);
  assert.equal(snap.telemetry.connectionState, null);
  assert.equal(snap.systems.available, false);
  assert.equal(snap.systems.onGround, null);
  assert.equal(snap.navigation.available, false);
  assert.equal(snap.navigation.waypointCount, null);

  const invalid = buildValidationEvidence(
    { mode: 'simconnect', connected: true },
    { connected: true, systems: { mode: 'simconnect', engineRpm: -900, altitudeAglFeet: '1000' }},
    { connected: true, navigation: { waypointIndex: -9, distanceNauticalMiles: NaN }},
    '2026-10-08T20:00:00Z',
  );
  assert.equal(invalid.systems.engineRpm, null);
  assert.equal(invalid.systems.altitudeAglFeet, null);
  assert.equal(invalid.navigation.waypointIndex, null);
  assert.equal(invalid.navigation.distanceNauticalMiles, null);
});

test('C31 rejects lingering mock system samples after source transition', () => {
  const snap = buildValidationEvidence(
    {mode:'simconnect',connected:true,sampleAgeMs:250},
    {connected:true,systems:{mode:'mock',engineRpm:2500,onGround:true}},
    {connected:false,navigation:null},
    '2026-10-08T20:00:00Z',
  );
  assert.equal(snap.systems.available,false);
  assert.equal(snap.systems.engineRpm,null);
  assert.equal(snap.systems.onGround,null);
});

test('C A320 captures only allowlisted candidate FCU and WASM evidence',()=>{
  const status={mode:'simconnect',connected:true,connectionState:'connected'};
  const airbus={
    connected:true,profileId:'a320-asobo-candidate',aircraft:'Airbus A320 Neo',
    fcuAgeMs:400,fcu:{selectedSpeedKnots:240,selectedHeadingDegrees:270,
      selectedAltitudeFeet:12000,selectedVerticalSpeedFpm:-700,
      latitude:49.2,controlToken:'super-secret'},
    lastError:'PRIVATE PATH'
  };
  const wasm={moduleReady:true,token:'WASM SECRET',lastError:'PRIVATE TOKEN'};
  const first=buildValidationEvidence(status,{}, {},'2026-10-12T08:00:00Z',airbus,wasm);
  assert.equal(first.a320.candidate,true);
  assert.equal(first.a320.fcuReadbackFresh,true);
  assert.equal(first.a320.wasmModuleReady,true);
  assert.equal(first.a320.fmaVerified,false);
  assert.equal(first.a320.selectedAltitudeFeet,12000);
  const serialized=JSON.stringify(first);
  assert.ok(!serialized.includes('super-secret'));
  assert.ok(!serialized.includes('PRIVATE'));
  assert.ok(!serialized.includes('latitude'));
  const second=buildValidationEvidence(status,{}, {},'2026-10-12T08:00:15Z',{
    ...airbus,fcu:{...airbus.fcu,selectedAltitudeFeet:14000}
  },wasm);
  const compare=compareEvidence(first,second);
  assert.equal(compare.comparable,true);
  assert.ok(compare.changes.some(x=>x.label.includes('ALT')&&x.delta===2000));
});

test('C A320 fails closed on mock, stale or mismatched candidate',()=>{
  const candidate={connected:true,profileId:'a320-asobo-candidate',
    aircraft:'Airbus A320 Neo',fcuAgeMs:9000,fcu:{selectedSpeedKnots:245}};
  const mock=buildValidationEvidence({mode:'mock',connected:true},{},{},
    '2026-10-12T08:00:00Z',candidate,{moduleReady:true});
  assert.equal(mock.a320.candidate,false);
  assert.equal(mock.a320.wasmModuleReady,false);
  const stale=buildValidationEvidence({mode:'simconnect',connected:true},{},{},
    '2026-10-12T08:00:00Z',candidate,{moduleReady:true});
  assert.equal(stale.a320.candidate,true);
  assert.equal(stale.a320.fcuReadbackFresh,false);
  assert.equal(stale.a320.selectedSpeedKnots,null);
  const addon=buildValidationEvidence({mode:'simconnect',connected:true},{},{},
    '2026-10-12T08:00:00Z',{...candidate,profileId:'a320-third-party'}, {moduleReady:true});
  assert.equal(addon.a320.candidate,false);
});
