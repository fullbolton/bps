// Guarded dedicated local test. Real local GoTrue sessions, synthetic users only.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw new Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();release=acquireLock();
 assert.equal(sql("SELECT obj_description(to_regclass('public.tasks'))='BPS synthetic task-prefill fixture v1' AND to_regclass('public.task_transfer_receipts') IS NOT NULL"),'t');
 sql(readFileSync(new URL('./fixtures/local-admin-assignment.sql',import.meta.url),'utf8'));
 if(sql("SELECT to_regprocedure('public.admin_assign_role_and_tenant(uuid,text,uuid)') IS NULL")==='t'){
  const old=readFileSync(new URL('../supabase/migrations/20260827000400_platform_admin_rpcs.sql',import.meta.url),'utf8'),start=old.indexOf('CREATE OR REPLACE FUNCTION public.admin_assign_role_and_tenant('),end=old.indexOf('COMMENT ON FUNCTION public.admin_assign_role_and_tenant(',start);
  assert.ok(start>0&&end>start);sql(old.slice(start,end));sql('REVOKE ALL ON FUNCTION admin_assign_role_and_tenant(uuid,text,uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION admin_assign_role_and_tenant(uuid,text,uuid) TO authenticated;');
 }
 const migration=readFileSync(new URL('../supabase/migrations/20260909001600_task_membership_guard.sql',import.meta.url),'utf8');
 if(sql("SELECT to_regprocedure('public.tasks_guard_active_assignee()') IS NULL")==='t')sql(migration);
 else{
  // All three triggers must exist. Refresh only current draft function definitions.
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('tasks_guard_active_assignee','membership_guard_active_tasks','profile_guard_active_tasks')"),'3');
  const bodies=[...migration.matchAll(/CREATE (?:OR REPLACE )?FUNCTION [\s\S]*?\$\$;/g)].map(m=>m[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
  assert.equal(bodies.length,4);const checkStart=migration.indexOf('-- Check REAL stored-function owners');assert.ok(checkStart>0);
  sql("BEGIN; SET LOCAL lock_timeout='15s';\n"+bodies.join('\n')+'\n'+migration.slice(checkStart,migration.lastIndexOf('COMMIT;'))+'COMMIT;');
 }
 sql("NOTIFY pgrst,'reload schema';");
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
 async function user(name,role,platform=false){const email=`guard-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);sql(`INSERT INTO profiles(id,role,display_name,is_platform_admin) VALUES('${uid}','${role}','${name}',${platform}); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);return {uid,email,password};}
 const actor=await user('Ayrılış kabul yöneticisi','yonetici',true),source=await user('Ayrılış kabul kaynak','operasyon'),target=await user('Ayrılış kabul hedef','ik'),viewer=await user('Ayrılış kabul görüntüleyici','goruntuleyici');
 const c=createClient(s.API_URL,s.ANON_KEY,options),sourceClient=createClient(s.API_URL,s.ANON_KEY,options);assert.ifError((await c.auth.signInWithPassword({email:actor.email,password:actor.password})).error);assert.ifError((await sourceClient.auth.signInWithPassword({email:source.email,password:source.password})).error);
 const taskSvc=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url)),transfer=await importActualTypeScript(new URL('../src/lib/services/task-transfer.ts',import.meta.url)),admin=await importActualTypeScript(new URL('../src/lib/services/platform-admin.ts',import.meta.url));
 let count=0;const pass=label=>{count++;console.log('PASS '+label);};
 let ready=false;for(let i=0;i<20;i++){const r=await c.rpc('is_platform_admin');if(!r.error&&r.data===true){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready);
 const task=await taskSvc.createTask(c,{legacyCompanyId:id(20),title:'Ayrılış koruması API kabulü',assignedToUserId:source.uid},{tenantId:id(1)});
 const sessionsBefore=Number(sql(`SELECT count(*) FROM auth.sessions WHERE user_id='${source.uid}'`));assert.ok(sessionsBefore>0);
 await assert.rejects(()=>admin.assignRoleAndTenant(c,{userId:source.uid,role:'operasyon',tenantId:id(2)}),e=>e instanceof admin.PlatformAdminError&&e.message.includes('açık işleri'));
 assert.equal(sql(`SELECT tenant_id FROM tenant_memberships WHERE user_id='${source.uid}'`),id(1));assert.equal(Number(sql(`SELECT count(*) FROM auth.sessions WHERE user_id='${source.uid}'`)),sessionsBefore);pass('real local admin rejects active-work tenant move without revoking sessions');
 await assert.rejects(()=>admin.assignRoleAndTenant(c,{userId:source.uid,role:'muhasebe',tenantId:id(1)}),e=>e.message.includes('açık işleri'));pass('role losing task access is rejected with useful service message');
 await admin.assignRoleAndTenant(c,{userId:source.uid,role:'ik',tenantId:id(1)});assert.equal(Number(sql(`SELECT count(*) FROM auth.sessions WHERE user_id='${source.uid}'`)),sessionsBefore);pass('same-tenant valid role change retains real Auth sessions');
 await assert.rejects(()=>taskSvc.createTask(c,{legacyCompanyId:id(20),title:'Rejected viewer ownership',assignedToUserId:viewer.uid},{tenantId:id(1)}),e=>e.message.includes('görev erişimi yok'));pass('ordinary create cannot assign active task to viewer');
 const scope={actorId:actor.uid,tenantId:id(1)},preview=await transfer.loadTransferPreview(c,scope,source.uid);
 await transfer.submitTransfer(c,scope,{commandId:randomUUID(),sourceId:source.uid,targetId:target.uid,tasks:preview.tasks.map(({id,revision})=>({id,revision}))});
 assert.equal(sql(`SELECT assigned_to_user_id FROM tasks WHERE id='${task.id}'`),target.uid);pass('existing scoped transfer cooperates with new active-assignee trigger');
 await admin.assignRoleAndTenant(c,{userId:source.uid,role:'operasyon',tenantId:id(2)});
 assert.equal(sql(`SELECT tenant_id FROM tenant_memberships WHERE user_id='${source.uid}'`),id(2));assert.equal(sql(`SELECT count(*) FROM auth.sessions WHERE user_id='${source.uid}'`),'0');assert.equal(sql(`SELECT count(*) FROM auth.refresh_tokens WHERE user_id::text='${source.uid}'`),'0');pass('post-transfer move revokes actual local GoTrue sessions and refresh tokens');
 assert.equal(sql(`SELECT count(*) FROM tasks WHERE title='Rejected viewer ownership'`),'0');pass('rejected new task left no row');
 console.log(`Local membership/task guard checks: ${count} passed.`);
}catch(error){console.error('Local membership guard acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
