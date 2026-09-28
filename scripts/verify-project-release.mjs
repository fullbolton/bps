import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import assert from 'node:assert/strict';
const qa='qa/project-completion-20260928';
const m=JSON.parse(readFileSync(qa+'/manifest.json'));
const env=parseEnv(readFileSync(m.directory+'/.env.production.local','utf8'));
assert.equal(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,'dffdzbmnmnokbftbujsy.supabase.co');
assert.ok(env.CRON_SECRET);
const response=await fetch('https://www.bpsys.net/api/healthz',{headers:{authorization:'Bearer '+env.CRON_SECRET},signal:AbortSignal.timeout(30000)});
const body=await response.json();
const checks=body.checks?.map(c=>({name:c.name,pass:c.pass}));
assert.equal(response.status,200);assert.equal(checks?.length,5);assert.ok(checks.every(c=>c.pass));
const id='00000000-0000-4000-8000-000000000001';
const denied=[];
for(const [name,args]of [
 ['reporting_project_list',{p_actor:id,p_tenant:id}],
 ['reporting_monthly_report',{p_actor:id,p_tenant:id,p_project:id,p_month:'2026-09'}],
 ['reporting_work_details',{p_actor:id,p_tenant:id,p_project:id,p_month:'2026-09'}],
 ['reporting_source_file',{p_actor:id,p_tenant:id,p_batch:id}],
]){
 const r=await fetch(env.NEXT_PUBLIC_SUPABASE_URL+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(20000)});
 assert.ok([401,403].includes(r.status),name+' anonymously callable');denied.push({name,status:r.status});
}
const routes=[];
for(const route of ['/projeler',`/projeler/${id}/rapor?ay=2026-09`,`/projeler/${id}/rapor/kayitlar?ay=2026-09`,`/projeler/${id}/aktarim`]){
 const r=await fetch('https://www.bpsys.net'+route,{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.ok([302,303,307,308].includes(r.status));assert.ok(r.headers.get('location')?.includes('/login'));routes.push({route,status:r.status});
}
const result={at:new Date().toISOString(),healthStatus:response.status,deployment:body.meta?.deployment,checks,anonymousRpc:denied,anonymousRoutes:routes};
writeFileSync(qa+'/live-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
