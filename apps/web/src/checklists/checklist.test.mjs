import test from 'node:test';import assert from 'node:assert/strict';
import {aircraftChecklistProfile,checklistSteps,normalizeChecklist} from './checklist.ts';
test('profil z TITLE, ale nenahrazuje výrobní checklist',()=>{
 assert.equal(aircraftChecklistProfile('Cessna 172 Skyhawk'),'c172');
 assert.equal(aircraftChecklistProfile('Daher TBM930'),'tbm930');
 assert.equal(aircraftChecklistProfile('Unknown'),'generic');
 assert.ok(checklistSteps('c172','beforeStart').length>3);
});
test('persistence reject injected or oversized custom entries',()=>{
 assert.deepEqual(normalizeChecklist(null),{checked:[],custom:[]});
 const state=normalizeChecklist({checked:['good','good',8],
 custom:[{id:'custom-aaa',text:'Upravená kontrola'},
 {id:'../bad',text:'unsafe'}, {id:'custom-bbb',text:''}]});
 assert.deepEqual(state.checked,['good']);
 assert.equal(state.custom.length,1);
});
