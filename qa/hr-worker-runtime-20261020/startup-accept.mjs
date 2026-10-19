import {execFileSync} from 'node:child_process';import {writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const image='public.ecr.aws/supabase/storage-api@sha256:5a3ecdc67dbe9e88a56810b5b2f432f2d93708dcb4dc9de34e78e342b390eb4d',volume=`bps-runtime-startup-${process.pid}`,root=fileURLToPath(new URL('../../workers/hr-malware',import.meta.url));
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
try{
 docker(['volume','create',volume]);
 docker(['run','--rm','--network','none','--entrypoint','node','-v',volume+':/state',image,'-e',"const fs=require('fs');fs.writeFileSync('/state/key','SYNTHETIC-ONLY',{mode:0o600});fs.writeFileSync('/state/health.json',JSON.stringify({schemaVersion:1,state:'idle',at:Date.now()}),{mode:0o600})"]);
 const common=['run','--rm','--network','none','--read-only','--entrypoint','node','-v',root+':/worker:ro','-v',volume+':/run/bps-worker'];
 const secret=docker([...common,image,'--input-type=module','-e',"import {readServiceSecret} from '/worker/runtime.mjs';console.log((await readServiceSecret('/run/bps-worker/key'))==='SYNTHETIC-ONLY'?'accepted':'rejected')"]);assert.equal(secret,'accepted');
 let failed=false;try{docker([...common,image,'/worker/main.mjs']);}catch(error){assert.equal(error.status,1);assert.deepEqual(JSON.parse(error.stdout),{state:'startup_failed'});failed=true;}assert.equal(failed,true);
 const state=JSON.parse(docker([...common,image,'-e',"console.log(require('fs').readFileSync('/run/bps-worker/health.json','utf8'))"]));assert.equal(state.state,'unavailable');
 let healthFailed=false;try{docker([...common,image,'/worker/health.mjs']);}catch(error){assert.equal(error.status,1);healthFailed=true;}assert.equal(healthFailed,true);
 const evidence={realLinuxContainer:true,realMainEntry:true,syntheticSecretOnly:true,strictRootSecretRead:true,failedStartupClearsPriorHealth:true,healthCommandRejects:true,realClamav:false,productionReady:false};writeFileSync(new URL('./startup-result.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
}finally{try{docker(['volume','rm',volume]);}catch{}}
