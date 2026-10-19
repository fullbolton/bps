import test from 'node:test';import assert from 'node:assert/strict';
import {validateMountPaths} from '../workers/hr-malware/host-preflight.mjs';
import {rotateManagedDeployment} from '../workers/hr-malware/managed-rotation.mjs';
const config={code:'/srv/bps/code',config:'/srv/bps/code/clamd.conf',socket:'/srv/bps/socket',health:'/srv/bps/health',control:'/srv/bps/control',secrets:'/srv/bps/secrets'};
test('canonical mounts allow config in code but reject aliases and overlaps',()=>{validateMountPaths(config);for(const secret of ['/srv/bps//secrets','/srv/bps/./secrets','/srv/bps/health/../secrets','/srv/bps/health/keys','/srv/bps','/'])assert.throws(()=>validateMountPaths({...config,secrets:secret}),/PATHS/);});
test('failed preflight prevents every rotation side effect',async()=>{const events=[];await assert.rejects(rotateManagedDeployment(config,{deployment:{},control:{lock:async()=>{events.push('lock');}},stage:async()=>events.push('stage'),preflight:async()=>{throw Error('unsafe host');}}),/unsafe host/);assert.deepEqual(events,[]);});
