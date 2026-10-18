// Synthetic-only: fresh PostgreSQL plus existing real HTTP acceptance harness.
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const source='supabase_db_bps-supabase-acceptance',target=`bps-combined-db-${process.pid}`;
const password=randomBytes(32).toString('hex');
const docker=(args,input)=>{try{return execFileSync('docker',args,{input,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});}catch{throw Error('Combined synthetic Docker step failed; credentials withheld');}};
const psql=(container,db,input)=>docker(['exec','-i',container,'psql','-XqAt','-U','supabase_admin','-d',db,'-v','ON_ERROR_STOP=1'],input);
let created=false,child;
try{
 const guard=docker(['exec',source,'psql','-XqAt','-U','postgres','-d','bps_module_chain_20261005','-c',"select count(*)=2 and bool_and(email like '%test%' or email like '%example%') from auth.users"]);
 assert.equal(guard.trim(),'t','Unexpected fixture');
 const roles=docker(['exec',source,'pg_dumpall','-U','postgres','--roles-only','--no-role-passwords']).replace(/^CREATE ROLE supabase_admin;$/m,'');
 const archive=docker(['exec',source,'pg_dump','-U','postgres','-d','bps_module_chain_20261005']);
 docker(['run','-d','--name',target,'--network','supabase_network_bps-supabase-acceptance','--user','postgres','-e',`POSTGRES_PASSWORD=${password}`,'--entrypoint','sh','public.ecr.aws/supabase/postgres:17.6.1.075','-c',"initdb -D /tmp/bps-data -U supabase_admin --auth-local=trust --auth-host=scram-sha-256 >/tmp/init.log && echo 'host all all samenet scram-sha-256' >> /tmp/bps-data/pg_hba.conf && exec postgres -D /tmp/bps-data -c listen_addresses='*'"]);created=true;
 let ready=false;for(let i=0;i<100;i++){try{docker(['exec',target,'pg_isready','-U','supabase_admin']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready);
 psql(target,'postgres',roles);
 psql(target,'postgres',`SELECT format('ALTER ROLE %I PASSWORD %L;',rolname,'${password}') FROM pg_roles WHERE rolcanlogin;\n\\gexec\nCREATE DATABASE bps_module_chain_20261005 OWNER postgres TEMPLATE template0;`);
 psql(target,'bps_module_chain_20261005',archive);
 child=spawn(process.execPath,['qa/contract-write-20261015/storage-http.mjs'],{stdio:'inherit',env:{...process.env,BPS_SYNTHETIC_DB_CONTAINER:target,BPS_RESTORE_REHEARSAL:'1',BPS_LOCAL_BROWSER:'1',BPS_AUTH_RESTORE_REHEARSAL:'1',BPS_AUTH_RESTORE_HTTP_ONLY:process.env.BPS_COMBINED_BROWSER==='1'?'0':'1'}});
 const stop=()=>child.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
 process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);
 assert.equal(code,0,'Combined acceptance failed');
 writeFileSync(new URL('./combined-result.json',import.meta.url),JSON.stringify({syntheticOnly:true,separateServer:true,postgresImage:'17.6.1.075',rolePasswords:'fresh random local password; none copied',httpAcceptancePassed:true,browserRequested:process.env.BPS_COMBINED_BROWSER==='1',browserVerified:false,limits:['historical synthetic baseline and same platform image','Auth and business schemas use separate databases with fixture hook sync','local file backend, not cloud S3','browser acceptance must be recorded separately']},null,2)+'\n');
 console.log('COMBINED_SERVER_HTTP_PASS');
}finally{if(created)docker(['rm','-f','-v',target]);}
