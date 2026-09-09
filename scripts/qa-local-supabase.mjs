/** Real local Auth/PostgREST acceptance. Never reads .env or accepts a remote URL.
 * Requires the dedicated blank Supabase stack /private/tmp/bps-supabase-acceptance.
 * Run once per blank stack; fails if pilot tables already exist, never resets data.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {id} from './fixtures/daily-operations.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const services=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
const workdir='/private/tmp/bps-supabase-acceptance';
const config=readFileSync(workdir+'/supabase/config.toml','utf8');
assert.match(config,/project_id = "bps-supabase-acceptance"/);
const status=JSON.parse(execFileSync('supabase',['status','--workdir',workdir,'-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
const url=new URL(status.API_URL);
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));assert.equal(url.port,'54321');
const container='supabase_db_bps-supabase-acceptance';
function sql(text){return execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],{input:text,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();}
assert.equal(sql("select to_regclass('public.ops_locations') is null"),'t','Dedicated stack is not blank; do not reset existing data.');
const client=key=>createClient(url.href,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const admin=client(status.SERVICE_ROLE_KEY),anon=client(status.ANON_KEY);
let count=0;const pass=label=>{count++;console.log('PASS '+label);};
// Explicit pilot contract fixture. Auth schema/functions are supplied by actual Supabase.
sql(`
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),role text NOT NULL);
CREATE TABLE public.tenant_memberships(user_id uuid NOT NULL REFERENCES profiles(id),tenant_id uuid NOT NULL REFERENCES tenants(id),UNIQUE(user_id,tenant_id));
CREATE TABLE public.companies(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES tenants(id),name text,status text);
CREATE FUNCTION public.current_user_verified_tenant() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS
$$ SELECT tenant_id FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=(auth.jwt()->'app_metadata'->>'active_tenant')::uuid $$;
CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_test_read ON public.companies FOR SELECT TO authenticated USING(tenant_id=public.current_user_verified_tenant());
GRANT SELECT ON public.companies TO authenticated;
INSERT INTO tenants VALUES('${id(1)}'),('${id(2)}');
INSERT INTO companies VALUES('${id(20)}','${id(1)}','Local test A','aktif'),('${id(21)}','${id(2)}','Local test B','aktif');
`);
for(const f of ['20260909000100_daily_operations_pilot.sql','20260909000200_location_import.sql'])sql(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
sql("NOTIFY pgrst,'reload schema';");
async function account(role,tenant){
  const password=randomUUID()+'aA1!',email=`${randomUUID()}@example.test`;
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(tenant)}});assert.ifError(error);
  const uid=data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
  assert.ok(['yonetici','operasyon','ik'].includes(role));
  sql(`INSERT INTO profiles VALUES('${uid}','${role}'); INSERT INTO tenant_memberships VALUES('${uid}','${id(tenant)}');`);
  const c=client(status.ANON_KEY),login=await c.auth.signInWithPassword({email,password});assert.ifError(login.error);assert.ok(login.data.session?.access_token);
  pass(`real Auth login: ${role}/tenant ${tenant}`);return {c,uid,token:login.data.session.access_token};
}
const manager=await account('yonetici',1),operator=await account('operasyon',1),ik=await account('ik',1),other=await account('yonetici',2);
async function ok(c,name,args){const r=await c.rpc(name,args);assert.ifError(r.error);return r.data;}
async function denied(c,name,args,pattern){const r=await c.rpc(name,args);assert.ok(r.error);assert.match(r.error.message,pattern);}
const cmd=(n,kind,payload)=>({p_command_id:id(n),p_kind:kind,p_payload:payload});
// Wait for schema cache availability only; errors other than missing RPC are not retried.
for(let n=0;;n++){const r=await manager.c.rpc('ops_board',{p_company_id:id(20),p_work_date:'2026-09-09'});if(!r.error)break;assert.ok(n<20&&r.error.code==='PGRST202',JSON.stringify(r.error));await new Promise(resolve=>setTimeout(resolve,100));}
assert.deepEqual((await services.listPilotCompanies(manager.c)).map(c=>c.id),[id(20)]);pass('actual company service returns verified tenant only');
await services.runPilotCommand(manager.c,id(100),'location',{companyId:id(20),name:'Test şube',city:'İstanbul'});
await ok(manager.c,'ops_mutate',cmd(101,'worker',{name:'Test personel',code:'T1',kind:'idp'}));
const request={companyId:id(20),locationId:id(100),workDate:'2026-09-09',serviceLine:'Temizlik',position:'Görevli',requiredCount:1};
await ok(operator.c,'ops_mutate',cmd(102,'request',request));
await ok(operator.c,'ops_mutate',cmd(103,'assign',{requestId:id(102),workerId:id(101)}));
const board=await services.loadPilotBoard(manager.c,id(20),'2026-09-09');
assert.equal(board.requests[0].assignments.length,1);pass('Auth JWT -> RPC -> board assignment');
await denied(operator.c,'ops_mutate',cmd(104,'worker',{name:'X',code:'X',kind:'idp'}),/OPS_FORBIDDEN/);pass('operator directory creation denied');
await denied(ik.c,'ops_board',{p_company_id:id(20),p_work_date:'2026-09-09'},/OPS_FORBIDDEN/);pass('IK board denied');
await denied(other.c,'ops_board',{p_company_id:id(20),p_work_date:'2026-09-09'},/OPS_OUT_OF_SCOPE/);pass('cross-tenant board denied');
const hidden=await other.c.from('ops_locations').select('*');assert.ifError(hidden.error);assert.deepEqual(hidden.data,[]);pass('PostgREST RLS hides other tenant');
const direct=await manager.c.from('ops_locations').insert({id:id(105),tenant_id:id(1),company_id:id(20),name:'Bypass',city:'X'});assert.ok(direct.error);pass('direct PostgREST write denied');
await denied(anon,'ops_board',{p_company_id:id(20),p_work_date:'2026-09-09'},/permission denied/);pass('anonymous RPC denied');
const importArgs={p_command_id:id(106),p_company_id:id(20),p_rows:[{code:'0001',name:'Import test',city:'Ankara'}]};
assert.equal((await services.runLocationImport(manager.c,id(106),id(20),importArgs.p_rows)).added,1);
assert.equal((await ok(manager.c,'ops_import_locations',{...importArgs,p_command_id:id(107)})).skipped,1);pass('real API import and duplicate skip');
await denied(operator.c,'ops_import_locations',{...importArgs,p_command_id:id(108)},/OPS_FORBIDDEN/);pass('operator import denied');
await ok(operator.c,'ops_mutate',cmd(109,'cancel',{requestId:id(102)}));
assert.equal((await ok(manager.c,'ops_board',{p_company_id:id(20),p_work_date:'2026-09-09'})).requests[0].assignments.length,0);pass('API cancel removes assignments');
sql(`UPDATE profiles SET role='ik' WHERE id='${manager.uid}';`);
await denied(manager.c,'ops_mutate',cmd(110,'request',request),/OPS_FORBIDDEN/);pass('existing JWT cannot bypass role revocation');
sql(`UPDATE profiles SET role='yonetici' WHERE id='${manager.uid}'; UPDATE tenant_memberships SET tenant_id='${id(2)}' WHERE user_id='${manager.uid}';`);
await denied(manager.c,'ops_mutate',cmd(111,'request',request),/OPS_FORBIDDEN/);pass('signed stale tenant JWT rejected after membership move');
console.log(`${count} local Supabase Auth/API checks passed. Full historical schema/admin RPC and browser UI NOT tested.`);
