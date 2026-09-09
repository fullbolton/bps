// Only guarded dedicated local Supabase, synthetic identities and files. Never reads .env.local.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1' AND to_regclass('public.contract_document_versions') IS NOT NULL"),'t');

 const migration=readFileSync(new URL('../supabase/migrations/20260909002500_daily_dashboard.sql',import.meta.url),'utf8');
 assert.equal(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='contract_document_role'"),'1');
 sql(migration.replace("CREATE FUNCTION public.daily_dashboard", "CREATE OR REPLACE FUNCTION public.daily_dashboard"));sql("NOTIFY pgrst,'reload schema';");
 console.log('PASS 02500 applied only to guarded synthetic local Supabase');
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options),c=createClient(s.API_URL,s.ANON_KEY,options);
 const email=`setup-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Aktivite kabul kullanıcısı'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);
  assert.ifError((await c.auth.signInWithPassword({email,password})).error);
  const args={p_actor_id:uid,p_tenant_id:id(1)};let response;
  for(let i=0;i<20;i++){response=await c.rpc('daily_dashboard',args);if(!response.error)break;await new Promise(r=>setTimeout(r,150));}
  assert.ifError(response.error);
  const parser=await importActualTypeScript(new URL('../src/lib/daily-dashboard.ts',import.meta.url));parser.parseDailyDashboard(response.data);
  console.log('PASS real authenticated RPC returns a scoped daily summary');
  assert.ok((await c.rpc('daily_dashboard',{...args,p_tenant_id:id(2)})).error);
  sql(`UPDATE profiles SET role='ik' WHERE id='${uid}'`);assert.ok((await c.rpc('daily_dashboard',args)).error);
  sql(`UPDATE profiles SET role='yonetici' WHERE id='${uid}'; DELETE FROM tenant_memberships WHERE user_id='${uid}'`);assert.ok((await c.rpc('daily_dashboard',args)).error);
  const anon=createClient(s.API_URL,s.ANON_KEY,options);assert.ok((await anon.rpc('daily_dashboard',args)).error);
  console.log('PASS real API rejects other tenant, revoked role, stale claim and anonymous access');
 }finally{sql(`DELETE FROM tenant_memberships WHERE user_id='${uid}'; DELETE FROM profiles WHERE id='${uid}'`);assert.ifError((await root.auth.admin.deleteUser(uid)).error);}

}catch(error){console.error('Workspace setup local apply failed: '+error.message);process.exitCode=1;}
finally{release?.();}
