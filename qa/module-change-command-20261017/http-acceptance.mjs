// LOCAL ONLY: disposable database/container and synthetic JWTs, no production grants.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from './fixture-migrations.mjs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {createModuleChangeAttempt}=await importActualTypeScript(new URL('../../src/lib/modules/change-attempt.ts',import.meta.url));
const source='supabase_db_bps-supabase-acceptance',database=`bps_module_http_${process.pid}`,rest=`bps-module-http-${process.pid}`;
const secrets=[];const redact=s=>secrets.reduce((a,b)=>a.split(b).join('[redacted]'),String(s));
function docker(args,input){try{return execFileSync('docker',args,{input,encoding:'utf8',timeout:20000,stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error(redact(e.stderr||'Docker failed'));}}
const sql=(q,db=database)=>docker(['exec','-i',source,'psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],q);
const password=docker(['exec',source,'printenv','POSTGRES_PASSWORD']);secrets.push(password);
const secret=randomBytes(48).toString('hex');secrets.push(secret);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function jwt(role,actor=11,tenant=1){const text=[{alg:'HS256',typ:'JWT'},{role,sub:id(actor),active_tenant_id:id(tenant),exp:Math.floor(Date.now()/1000)+600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');const value=text+'.'+createHmac('sha256',secret).update(text).digest('base64url');secrets.push(value);return value;}
const auth=jwt('authenticated'),anon=jwt('anon'),service=jwt('service_role');
const signature='public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)';
const report={scope:'Local PostgREST with synthetic signed JWTs, not GoTrue login or browser acceptance',checks:[],success:false,cleaned:false};let created=false,started=false;
try{
 sql(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 sql(readFileSync(new URL('./command-candidate.sql',import.meta.url),'utf8'));
 const uri=`postgres://authenticator:${encodeURIComponent(password)}@${source}:5432/${database}`;secrets.push(uri);
 docker(['run','-d','--name',rest,'--network','supabase_network_bps-supabase-acceptance','-p','127.0.0.1::3000','-e',`PGRST_DB_URI=${uri}`,'-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,'public.ecr.aws/supabase/postgrest:v14.3']);started=true;
 const base='http://127.0.0.1:'+docker(['port',rest,'3000/tcp']).split(':').at(-1);
 async function rpc(name,body={},token=auth){const r=await fetch(base+'/rpc/'+name,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});return {status:r.status,ok:r.ok,data:await r.json()};}
 let ctx;for(let i=0;i<80;i++){try{const r=await rpc('current_workspace_modules_v1');if(r.ok){ctx=r.data;break;}}catch{}await new Promise(r=>setTimeout(r,150));}assert.ok(ctx,'Local REST not ready');
 const modules={...ctx.modules,announcements:!ctx.modules.announcements};
 const payload={p_actor:ctx.actorId,p_tenant:ctx.tenantId,p_membership_version:ctx.membershipVersion,p_selection_version:ctx.selectionVersion,p_revision:ctx.configRevision,p_command:id(9800),p_modules:modules};
 assert.equal((await rpc('change_workspace_modules_v1',payload)).status,403);report.checks.push('candidate denied before local-only grant');
 sql(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`);
 for(const token of [anon,service])assert.ok(!(await rpc('change_workspace_modules_v1',payload,token)).ok);
 report.checks.push('anon and service remain denied after authenticated-only local grant');
 const attempt=createModuleChangeAttempt(ctx,id(9800),modules);let calls=0;
 const transport=async p=>{calls++;const r=await rpc('change_workspace_modules_v1',p);assert.ok(r.ok,JSON.stringify(r.data));return r.data;};
 assert.equal((await attempt.send(ctx,async p=>{await transport(p);throw Error('Synthetic lost response after HTTP success');})).status,'unconfirmed');
 const current=(await rpc('current_workspace_modules_v1')).data;
 assert.equal(BigInt(current.configRevision),BigInt(ctx.configRevision)+1n);
 const recovered=await attempt.send(current,transport);assert.equal(recovered.status,'committed');assert.equal(recovered.receipt.replayed,true);assert.equal(calls,2);
 assert.equal(sql(`SELECT count(*) FROM tenant_module_changes WHERE command_id='${id(9800)}';`),'1');
 assert.equal((await rpc('current_workspace_modules_v1')).data.configRevision,current.configRevision);
 report.checks.push('HTTP commit followed by response-loss injection replays exactly one receipt and revision');
 const foreign=await rpc('change_workspace_modules_v1',{...payload,p_command:id(9801)},jwt('authenticated',12,2));assert.equal(foreign.status,403);
 report.checks.push('another tenant cannot invoke the original actor intent');
 sql(`REVOKE EXECUTE ON FUNCTION ${signature} FROM authenticated;`);
 assert.equal((await rpc('change_workspace_modules_v1',payload)).status,403);report.checks.push('revoked permission prevents even replay');
 report.success=true;
}catch(e){report.error=redact(e.stack||e);}
finally{
 const errors=[];if(started)try{docker(['rm','-f',rest]);}catch(e){errors.push(e.message);}
 if(created)try{sql(`DROP DATABASE ${database} WITH (FORCE);`,'postgres');}catch(e){errors.push(e.message);}
 report.cleaned=errors.length===0;if(errors.length)report.cleanupErrors=errors;
 writeFileSync(new URL('./http-result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
process.exitCode=report.success&&report.cleaned?0:1;
