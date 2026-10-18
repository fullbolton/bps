// Runs only the disposable local fixture; deliberately no production env files.
import {spawn} from 'node:child_process';
const env={...process.env,BPS_LOCAL_BROWSER:'1',BPS_DAILY_OPERATIONS_ENABLED:'true',BPS_WORK_APPROVAL_ENABLED:'true',BPS_REPLACEMENT_OUTREACH_ENABLED:'true',NEXT_PUBLIC_BPS_WORK_APPROVAL_ENABLED:'true',NEXT_PUBLIC_BPS_REPLACEMENT_OUTREACH_ENABLED:'true'};
const child=spawn(process.execPath,['qa/contract-write-20261015/storage-http.mjs'],{env,stdio:'inherit'});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill(signal));
child.once('error',error=>{console.error(error.message);process.exitCode=1;});
child.once('exit',code=>{process.exitCode=code??1;});
