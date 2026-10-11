import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventSampleIndex} from './replayEvents.ts';
const samples=['2026-10-11T10:00:00Z','2026-10-11T10:00:01Z',
  '2026-10-11T10:00:02Z'].map(timestampUtc=>({timestampUtc}));
test('event opens its exact sample',()=>assert.equal(eventSampleIndex(samples,samples[1].timestampUtc),1));
test('missing or unsafe event timestamps never invent GPS samples',()=>{
  assert.equal(eventSampleIndex(samples,'2026-10-11T10:04:00Z'),null);
  assert.equal(eventSampleIndex(samples,'bad'),null);
  assert.equal(eventSampleIndex([],samples[0].timestampUtc),null);
});
