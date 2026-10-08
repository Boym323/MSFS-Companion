import {test} from 'node:test'; import assert from 'node:assert/strict';
import {pilotPhase,pilotHints} from './pilotLogic.ts';
const base={onGround:false,airspeedKnots:100,verticalSpeedFeetPerMinute:0,altitudeAglFeet:2000};
test('bez potvrzeného onGround se fáze neodhaduje',()=>assert.equal(pilotPhase({...base,onGround:null}),'unknown'));
test('přiblížení vyžaduje AGL i zápornou VS',()=>{assert.equal(pilotPhase({...base,altitudeAglFeet:500,verticalSpeedFeetPerMinute:-300}),'approach');assert.equal(pilotPhase({...base,altitudeAglFeet:null,verticalSpeedFeetPerMinute:-300}),'descent')});
test('země má přednost a bez dat nejsou živé instrukce',()=>{assert.equal(pilotPhase({...base,onGround:true,verticalSpeedFeetPerMinute:800}),'ground');assert.equal(pilotPhase(null),'unknown');assert.equal(pilotHints('unknown').length,1);});
