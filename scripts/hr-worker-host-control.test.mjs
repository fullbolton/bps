import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createHostControl} from '../workers/hr-malware/host-control.mjs';
async function setup(run){const dir=await mkdtemp(join(tmpdir(),'bps-control-'));try{await run(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('host lock excludes another updater and pause requires lock',()=>setup(async dir=>{
 const args={controlDirectory:dir,healthPath:dir+'/health'},a=createHostControl(args),b=createHostControl(args);
 await assert.rejects(a.pause());const release=await a.lock();await assert.rejects(b.lock());await a.pause();await assert.rejects(a.resume());await release();const unlock=await b.lock();await assert.rejects(b.pause());await unlock();await access(dir+'/pause');
}));
test('only current fresh acknowledgement permits host resume',()=>setup(async dir=>{
 const args={controlDirectory:dir,healthPath:dir+'/health',now:()=>10000,sleep:async()=>{}},a=createHostControl(args);const release=await a.lock();await a.pause();const {requestId}=JSON.parse(await readFile(dir+'/pause','utf8'));
 for(const h of [{at:10000,maintenanceId:'old'},{at:-6000,maintenanceId:requestId},{at:10001,maintenanceId:requestId}]){await writeFile(args.healthPath,JSON.stringify({schemaVersion:1,state:'maintenance',...h}));await assert.rejects(a.waitDrained(),/DRAIN_TIMEOUT/);}
 await writeFile(args.healthPath,JSON.stringify({schemaVersion:1,state:'maintenance',at:10000,maintenanceId:requestId}));await a.waitDrained();await a.resume();await assert.rejects(access(dir+'/pause'));await release();
}));
test('drain timeout and replaced request preserve maintenance marker',()=>setup(async dir=>{
 const args={controlDirectory:dir,healthPath:dir+'/health',now:()=>10000,sleep:async()=>{}},a=createHostControl(args);const release=await a.lock();await a.pause();await assert.rejects(a.waitDrained());const {requestId}=JSON.parse(await readFile(dir+'/pause','utf8'));await writeFile(args.healthPath,JSON.stringify({schemaVersion:1,state:'maintenance',at:10000,maintenanceId:requestId}));await a.waitDrained();await writeFile(dir+'/pause',JSON.stringify({requestId:'replacement'}));await assert.rejects(a.resume(),/CONTROL_CHANGED/);await access(dir+'/pause');await release();
}));

test('old release cannot remove a later lock from the same controller',()=>setup(async dir=>{const a=createHostControl({controlDirectory:dir,healthPath:dir+'/health'});const first=await a.lock();await first();const second=await a.lock();await first();await access(dir+'/rotation.lock');await second();await assert.rejects(access(dir+'/rotation.lock'));}));
