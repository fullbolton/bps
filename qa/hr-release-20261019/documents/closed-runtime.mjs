// Start the production build with BPS_HR_PREVIEW_ENABLED=false on loopback 3070.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='http://127.0.0.1:3070',checks=[];
for(const origin of [base,'https://untrusted.example']){
 const response=await fetch(base+'/api/hr/documents/upload',{method:'POST',headers:{origin},body:'synthetic-invalid-body',redirect:'manual',signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,404);assert.equal(response.headers.get('location'),null);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{ok:false});checks.push({origin,status:404,noRedirect:true});
}
writeFileSync(new URL('build-runtime-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceHasUncommittedChanges:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().length>0,localProductionRuntime:true,syntheticEnv:true,hrPreview:false,uploadDisabled:checks,productionDeployed:false},null,2)+'\n');
console.log('PASS: compiled runtime returns no-store JSON 404, no login redirect, for both upload origins');
