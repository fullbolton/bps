// Run preserved Fable scenarios against02900 in disposable test copies. Requires BPS_EMBEDDED_PG_MODULE.
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
const dir=await mkdtemp(repo+'/scripts/.codex-start-regression-');
try{
 let harness=await readFile(repo+'/scripts/fable-review-01/harness.mjs','utf8');
 harness=harness.replace("'002700_start_tracking'];","'002700_start_tracking','002900_start_event_validation'];");
 await writeFile(dir+'/harness.mjs',harness);
 const names=['s2-two-operators.mjs','s4-confirm-attendance-replacement.mjs','s5-scope-change.mjs'];
 for(const name of names)await writeFile(dir+'/'+name,await readFile(repo+'/scripts/fable-review-01/'+name));
 execFileSync(process.execPath,['--test','--test-concurrency=1',...names.map(n=>dir+'/'+n)],{cwd:repo,env:{...process.env,BPS_FABLE_PG_PORT:process.env.BPS_FABLE_PG_PORT??'55480'},stdio:'inherit'});
}finally{await rm(dir,{recursive:true,force:true});}
