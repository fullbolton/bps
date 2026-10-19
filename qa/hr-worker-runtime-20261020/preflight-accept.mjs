import {execFileSync} from 'node:child_process';import {writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const raw=execFileSync('docker',['run','--rm','--network','none','--read-only','--tmpfs','/run:rw,nosuid,nodev,size=8m','--entrypoint','node','-v',root+'workers/hr-malware:/worker:ro','-v',root+'qa/hr-worker-runtime-20261020:/evidence:ro','public.ecr.aws/supabase/storage-api@sha256:5a3ecdc67dbe9e88a56810b5b2f432f2d93708dcb4dc9de34e78e342b390eb4d','/evidence/preflight-runner.mjs'],{encoding:'utf8',timeout:30000});
const result=JSON.parse(raw);writeFileSync(new URL('./preflight-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
