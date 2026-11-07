import test from 'node:test';
import assert from 'node:assert/strict';
import {isLocalHost,simbridgeUrls} from './simbridgeUrl.ts';

test('official URL and alternative for the same private-LAN Windows PC',()=>{
  assert.deepEqual(simbridgeUrls('192.168.1.25',8380),{
    primary:'http://simbridge.local:8380/interfaces/mcdu',
    alternate:'http://192.168.1.25:8380/interfaces/mcdu'
  });
  assert.equal(simbridgeUrls('simbridge.local',8380).alternate,null);
  assert.equal(simbridgeUrls('kokpit.local',8380).alternate,
    'http://kokpit.local:8380/interfaces/mcdu');
  assert.equal(simbridgeUrls('10.2.3.4',8381).alternate,
    'http://10.2.3.4:8381/interfaces/mcdu');
  assert.equal(simbridgeUrls('172.16.0.1',8380).alternate,
    'http://172.16.0.1:8380/interfaces/mcdu');
});
test('never produce alternate browser links from public or invalid hosts',()=>{
  for(const host of ['evil.example','192.168.1.25.evil.com',
    '192.168.1.999','172.32.0.1','8.8.8.8','a.local.evil.com','[::1]']){
    assert.equal(isLocalHost(host),false,host);
    assert.equal(simbridgeUrls(host,8380).alternate,null,host);
  }
  assert.equal(simbridgeUrls('192.168.0.2',1).primary,
    'http://simbridge.local:8380/interfaces/mcdu');
  assert.equal(simbridgeUrls('192.168.0.2',65536).alternate,
    'http://192.168.0.2:8380/interfaces/mcdu');
});
