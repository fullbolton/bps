import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createEngineReader} from '/worker/config.mjs';
import {scanBytes} from '/worker/clamd.mjs';
import {runHrScan} from '/worker/job.mjs';
const digest=createHash('sha256').update(readFileSync('/evidence/clamd.conf')).digest('hex');
const readEngineState=createEngineReader({expectedDigest:digest,acceptanceOnly:true});
await assert.rejects(createEngineReader({expectedDigest:'0'.repeat(64),acceptanceOnly:true})(),/HR_SCAN_CONFIG_CHANGED/);
const state=await readEngineState(),checks=[];
for(const [file,verdict] of [['clean.pdf','clean'],['encrypted.pdf','infected'],['limit.pdf','infected']]){
 const bytes=readFileSync('/fixtures/'+file),expected={tenantId:'00000000-0000-4000-8000-000000000001',uploadId:'00000000-0000-4000-8000-000000000002',objectId:'00000000-0000-4000-8000-000000000003',objectVersion:'synthetic',sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
 const saved=[];
 const report=await runHrScan({expected,readObject:async()=>({...expected,bytes}),readBinding:async()=>expected,readEngineState,scan:b=>scanBytes(b,{socketPath:'/run/bps-clam/clamd.sock'}),persist:async r=>saved.push(r)});
 assert.equal(report.verdict,verdict);assert.equal(report.complete,verdict==='clean');assert.equal(saved.length,1);checks.push({file,verdict,complete:report.complete});
}
writeFileSync('/evidence/config-job-result.json',JSON.stringify({measuredAt:new Date().toISOString(),state,realEngine:true,realProcessMeasurement:true,realUnixTransport:true,storageAndPersistence:'synthetic adapters',productionReady:false,checks},null,2)+'\n');console.log('PASS measured config and real worker jobs',checks);
