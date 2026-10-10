import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {freshMcduGps,mcduMinutes,mcduValue,mcduWaypointName} from './mcduModel.ts';
const gps={flightPlanActive:true,waypointActive:true,waypointCount:5,waypointIndex:2,
 nextWaypointId:'BERDI',distanceNauticalMiles:28.1,eteSeconds:575,
 desiredTrackDegrees:245,crossTrackNauticalMiles:-.1,
 totalFlightPlanNauticalMiles:250,groundTrackDegrees:244};
const status={connected:true,aircraft:'Airbus A320 Neo',
 profileId:'a320-asobo-candidate',mcduScreenAvailable:false,
 mcduKeysAvailable:false,mcduFlightPlanVerified:false,keyActions:[],
 source:'generic_gps_simvars',gpsAgeMs:300,gps,note:''};
test('MCDU diagnostic readback requires fresh candidate identity',()=>{
 assert.equal(freshMcduGps(status,'Airbus A320 Neo',true,500)?.nextWaypointId,'BERDI');
 assert.equal(freshMcduGps(status,'Boeing 737',true,500),null);
 assert.equal(freshMcduGps({...status,connected:false},'Airbus A320 Neo',true,0),null);
 assert.equal(freshMcduGps({...status,profileId:'airbus-addon'},'Airbus A320 Neo',true,0),null);
 assert.equal(freshMcduGps({...status,source:'airbus_mcdu_unverified'},'Airbus A320 Neo',true,0),null);
 assert.equal(freshMcduGps(status,'Airbus A320 Neo',false,0),null);
});
test('GPS old/future/invalid samples must not show as available',()=>{
 assert.equal(freshMcduGps(status,'Airbus A320 Neo',true,5700),null);
 assert.equal(freshMcduGps(status,'Airbus A320 Neo',true,-1),null);
 assert.equal(freshMcduGps({...status,gpsAgeMs:NaN},'Airbus A320 Neo',true,0),null);
 assert.equal(freshMcduGps({...status,gps:{...gps,waypointCount:-1}},'Airbus A320 Neo',true,0),null);
});
test('MCDU never invents an unknown waypoint or time',()=>{
 assert.equal(mcduWaypointName(gps),'BERDI');
 assert.equal(mcduWaypointName({...gps,nextWaypointId:null}),'GPS WP');
 assert.equal(mcduWaypointName({...gps,waypointActive:false}),'-----');
 assert.equal(mcduMinutes(null),'---');
 assert.equal(mcduMinutes(125),'3 MIN');
 assert.equal(mcduValue(Infinity),'---');
 assert.equal(mcduValue(null),'---');
});
test('MCDU hardware keycaps cannot send unverified simulator commands',()=>{
 const ui=readFileSync(new URL('./A320McduPanel.tsx',import.meta.url),'utf8');
 assert.match(ui,/const disabledKeys=/);
 assert.match(ui,/<button key=\{key\} type="button"[\s\S]*?disabled>\{key\}<\/button>/);
 assert.doesNotMatch(ui,/method:\s*['"]POST['"]/);
 assert.match(ui,/\/api\/a320\/mcdu\/status/);
});
