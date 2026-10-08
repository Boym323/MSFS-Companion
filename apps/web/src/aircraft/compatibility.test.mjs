import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibilityChecks, compatibilityReport, profileLabel } from './compatibility.ts';

const valid = {
  mode: 'simconnect', trueAirspeedKnots: 90, groundSpeedKnots: 85, altitudeAglFeet: 200,
  windDirectionDegrees: 0, windSpeedKnots: 0, onGround: false, flapsPercent: 0,
  gearDown: true, autopilotMaster: false, autopilotSelectedHeadingDegrees: 0,
  autopilotSelectedAltitudeFeet: 0, autopilotSelectedVerticalSpeedFpm: 0,
  engineRpm: 1900, fuelGallons: 15,
};
test('známé varianty mají jen obecný profil', () => {
  assert.equal(profileLabel('Asobo XCub Floats'), 'XCub / XCub Floats');
  assert.match(profileLabel('Cessna 172'), /Cessna/);
});
test('nula se nepovažuje za důkaz nekompatibility', () => {
  assert.ok(compatibilityChecks(valid).every((check) => check.state === 'received'));
  assert.ok(compatibilityChecks(null).every((check) => check.state === 'unavailable'));
});
test('neplatná veličina zůstane podezřelá', () => {
  const checks = compatibilityChecks({ ...valid, fuelGallons: Number.NaN });
  assert.equal(checks.find((c) => c.label === 'Motor / palivo')?.state, 'suspect');
});
test('export neobsahuje GPS a neprohlašuje kompatibilitu za ověřenou', () => {
  const report = compatibilityReport('XCub', valid, 200);
  assert.equal(report.verification, 'NOT_VERIFIED_IN_SIMULATOR');
  assert.doesNotMatch(JSON.stringify(report), /latitude|longitude|gps/i);
});
