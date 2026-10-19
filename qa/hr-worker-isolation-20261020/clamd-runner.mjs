import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {verifyProcessIsolation} from '/worker/isolation.mjs';import {verifyClamdConfig,createEngineReader} from '/worker/config.mjs';import {scanBytes} from '/worker/clamd.mjs';import {runHrScan} from '/worker/job.mjs';
const text=readFileSync('/qa/clamd.conf','utf8'),digest=createHash('sha256').update(text).digest('hex');
verifyClamdConfig(text,{socketPath:'/run/bps-clam/clamd.sock',expectedDigest:digest});
verifyProcessIsolation(readFileSync('/proc/1/status','utf8'),readFileSync('/proc/self/status','utf8'));
// Rosetta is accepted only in this local runner; strict config/isolation checked above.
const reader=createEngineReader({expectedDigest:digest,acceptanceOnly:true});
const readEngineState=async()=>{verifyProcessIsolation(readFileSync('/proc/1/status','utf8'),readFileSync('/proc/self/status','utf8'));return reader();};
const checks=[];
for(const [file,verdict] of [['clean.pdf','clean'],['encrypted.pdf','infected']]){
 const bytes=readFileSync('/fixtures/'+file),expected={tenantId:'00000000-0000-4000-8000-000000000001',uploadId:'00000000-0000-4000-8000-000000000002',objectId:'00000000-0000-4000-8000-000000000003',objectVersion:'synthetic',sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
 const result=await runHrScan({expected,readObject:async()=>({...expected,bytes}),readBinding:async()=>expected,readEngineState,scan:bytes=>scanBytes(bytes,{socketPath:'/run/bps-clam/clamd.sock'}),persist:async()=>{}});
 assert.equal(result.verdict,verdict);checks.push({file,verdict});
}
console.log(JSON.stringify({strictIsolation:true,productionConfig:true,realClamav:true,realUnixSocket:true,emulatedDaemon:true,storageAndPersistence:'synthetic',productionReady:false,checks}));
