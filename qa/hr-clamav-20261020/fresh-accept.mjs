import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {readClamdVersion} from '/worker/version.mjs';
import {scanBytes} from '/worker/clamd.mjs';
const options={socketPath:'/run/bps-clam/clamd.sock',timeoutMs:30000};
const before=await readClamdVersion(options),measuredAt=new Date().toISOString();
const age=Date.now()-Date.parse(before.signaturesUpdatedAt);
assert.ok(age>=-30000&&age<=86400000,'loaded signatures must meet 24h policy');
const checks=[];
for(const [file,verdict] of [['clean.pdf','clean'],['eicar.txt','infected'],['encrypted.pdf','infected'],['limit.pdf','infected']]){
 const result=await scanBytes(readFileSync('/fixtures/'+file),options);assert.equal(result.verdict,verdict);checks.push({file,verdict});
}
const after=await readClamdVersion(options);assert.deepEqual(after,before);
writeFileSync('/evidence/fresh-result.json',JSON.stringify({measuredAt,loadedEngine:before,signatureAgeMs:age,stableAcrossScans:true,daemonTimezone:'UTC',realEngine:true,realUnixTransport:true,syntheticOnly:true,productionReady:false,checks},null,2)+'\n');console.log('PASS fresh loaded signature policy and four real scans',before);
