import test from 'node:test';import assert from 'node:assert/strict';
import {bootstrapManagedDeployment} from '../workers/hr-malware/bootstrap.mjs';
const now=Date.now(),stamp=new Date(now).toISOString();
const engine={signatureVersion:'20',signaturesUpdatedAt:stamp,measuredAt:stamp,instanceId:'new',configurationDigest:'digest',policy:'hr-pdf-v1',engine:'clamav',configurationVerified:true,alertEncrypted:true,alertExceedsMax:true,scanPdf:true,engineVersion:'1'};
function setup(fail,measurement=engine){const events=[];const op=n=>async()=>{events.push(n);if(n===fail)throw Error(n);};return {events,options:{now:()=>now,preflight:op('preflight'),control:{lock:async()=>{events.push('lock');return op('unlock');},pause:op('pause'),waitDrained:op('drain'),resume:op('resume')},deployment:{assertAbsent:op('absent'),startDaemon:op('daemon'),startWorker:op('worker'),measure:async()=>{events.push('measure');return measurement;}}}};}
test('bootstrap stays paused until worker acknowledgement and live measurement',async()=>{const {events,options}=setup();const r=await bootstrapManagedDeployment({digest:'digest'},'volume',options);assert.equal(r.state,'ready');assert.deepEqual(events,['preflight','lock','absent','pause','daemon','worker','drain','measure','resume','unlock']);});
test('native preflight failure cannot lock or start anything',async()=>{const {events,options}=setup('preflight');await assert.rejects(bootstrapManagedDeployment({},'volume',options));assert.deepEqual(events,['preflight']);});
test('existing deployment is rejected without pause or container mutations',async()=>{const {events,options}=setup('absent');await assert.rejects(bootstrapManagedDeployment({},'volume',options));assert.deepEqual(events,['preflight','lock','absent','unlock']);});
test('partial startup and missing acknowledgement preserve pause',async()=>{for(const point of ['daemon','worker','drain']){const {events,options}=setup(point);await assert.rejects(bootstrapManagedDeployment({},'volume',options));assert.ok(!events.includes('resume'));assert.equal(events.at(-1),'unlock');}});
test('stale signatures or wrong measured config never resume',async()=>{for(const e of [{...engine,signaturesUpdatedAt:new Date(now-86400001).toISOString()},{...engine,configurationDigest:'other'}]){const {events,options}=setup(null,e);await assert.rejects(bootstrapManagedDeployment({digest:'digest'},'volume',options));assert.ok(!events.includes('resume'));assert.equal(events.at(-1),'unlock');}});

test('Docker inventory rejects stopped or running reserved names without mutation',async()=>{
 const {createDeployment}=await import('../workers/hr-malware/deployment.mjs');
 const c={name:'bps-test',tenant:'00000000-0000-4000-8000-000000000001',worker:'00000000-0000-4000-8000-000000000002',digest:'a'.repeat(64),origin:'https://example.test',code:'/code',config:'/config',socket:'/socket',health:'/health',control:'/control',secrets:'/secrets'};
 for(const names of ['bps-test-worker','bps-test-clamd']){const calls=[];const d=createDeployment(c,{run:async a=>{calls.push(a);return names;}});await assert.rejects(d.assertAbsent(),/ALREADY_EXISTS/);assert.deepEqual(calls,[['ps','-a','--format','{{.Names}}']]);}
 const d=createDeployment(c,{run:async()=> 'unrelated\nbps-test-worker-other'});await d.assertAbsent();
});
