// Additive synthetic-only integration. No .env, production schema, or reset.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});
const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
const release=acquireLock();
try {
  assert.equal(sql(`SELECT count(*) FROM public.tenants WHERE id IN ('${id(1)}','${id(2)}')`),'2');
  sql(readFileSync(new URL('./fixtures/local-task-prefill.sql',import.meta.url),'utf8'));
  if(sql("SELECT to_regclass('public.task_assignment_history') IS NULL")==='t') {
    sql(readFileSync(new URL('../supabase/migrations/20260909001300_task_assignment_history.sql',import.meta.url),'utf8'));
  }
  assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.tasks'::regclass AND tgname IN ('tasks_advance_revision','tasks_record_assignment') AND tgenabled='O'"),'2');
  sql("NOTIFY pgrst,'reload schema';");
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
  const password=randomUUID()+'aA1!',email=`task-${randomUUID()}@example.test`;
  const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
  const uid=created.data.user.id; assert.match(uid,/^[0-9a-f-]{36}$/);
  sql(`INSERT INTO public.profiles(id,role,display_name) VALUES('${uid}','yonetici','Görev kabul yöneticisi'); INSERT INTO public.tenant_memberships VALUES('${uid}','${id(1)}');`);
  const client=createClient(s.API_URL,s.ANON_KEY,options);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  // PostgREST reload is asynchronous; retry a read, never a business write.
  let ready=false;
  for(let n=0;n<20;n++){const result=await client.from('tasks').select('id,revision').limit(1);if(!result.error){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,200));}
  assert.ok(ready,'local fixture schema reload');
  const ops=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
  const tasks=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url));
  const profiles=await importActualTypeScript(new URL('../src/lib/services/profiles.ts',import.meta.url));
  const {buildTaskPrefill}=await importActualTypeScript(new URL('../src/lib/operations/task-prefill.ts',import.meta.url));
  let count=0; const pass=label=>{count++;console.log('PASS '+label);};
  const locationId=randomUUID(),requestId=randomUUID();
  await ops.runPilotCommand(client,locationId,'location',{companyId:id(20),name:'Görev kabul şubesi',city:'İstanbul'});
  await ops.runPilotCommand(client,requestId,'request',{companyId:id(20),locationId,workDate:'2026-09-09',serviceLine:'Temizlik',position:'Görev kabulü',requiredCount:1});
  const board=await ops.loadPilotBoard(client,id(20),'2026-09-09');
  const prefill=buildTaskPrefill({companyId:id(20),requestId,date:'2026-09-09'},await ops.listPilotCompanies(client),board);
  assert.match(prefill.title,/Görev kabul şubesi/); pass('scoped live board prepares correct company and title');
  const members=await profiles.listActiveTenantProfiles(client);assert.ok(members.some(p=>p.id===uid));pass('existing assignee picker RPC resolves synthetic tenant members');
  const task=await tasks.createTask(client,{legacyCompanyId:prefill.companyId,title:prefill.title},{tenantId:id(1)});
  assert.equal(task.company_id,id(20));assert.equal(task.assigned_to_user_id,null);assert.equal(task.source_ref,null);assert.equal(task.source_type,'manuel');pass('existing service creates unassigned task without claiming a source relation');
  assert.ok((await tasks.listAllTasks(client)).some(t=>t.id===task.id));pass('created task is visible through existing list service');
  const assigned=await tasks.updateTask(client,task.id,{assignedToUserId:uid,expectedRevision:task.revision});assert.equal(assigned.assigned_to_user_id,uid);assert.equal(assigned.assigned_to,'Görev kabul yöneticisi');pass('existing reassignment derives matching profile identity and name');
  await assert.rejects(()=>tasks.updateTask(client,task.id,{assignedToUserId:null,expectedRevision:task.revision}),e=>e.name==='TaskConflictError');pass('stale service revision cannot overwrite saved assignment');
  const unassigned=await tasks.updateTask(client,task.id,{assignedToUserId:null,expectedRevision:assigned.revision});assert.equal(unassigned.assigned_to_user_id,null);assert.equal(unassigned.assigned_to,null);pass('existing unassign clears identity and display name');
  const completed=await tasks.updateTask(client,task.id,{status:'tamamlandi',expectedRevision:unassigned.revision});
  const history=await tasks.listTaskAssignmentHistory(client,task.id);assert.deepEqual(history.rows.map(r=>r.kind),['unassigned','assigned','created']);assert.equal(history.rows[0].actor_id,uid);pass('scoped real API history reflects assignment and unassignment');
  assert.equal((await ops.loadPilotBoard(client,id(20),'2026-09-09')).requests.find(r=>r.id===requestId).lifecycle,'active');pass('task completion leaves daily request active');
  await assert.rejects(()=>tasks.createTask(client,{legacyCompanyId:id(21),title:'Out of scope'},{tenantId:id(1)}));pass('foreign company cannot be used through existing service');
  sql(`UPDATE profiles SET role='ik' WHERE id='${uid}';`);
  await assert.rejects(()=>tasks.updateTask(client,task.id,{assignedToUserId:uid,expectedRevision:completed.revision}),e=>e.name==='TaskReassignPermissionError');pass('existing HR reassignment restriction remains enforced');
  sql(`UPDATE profiles SET role='yonetici' WHERE id='${uid}';`);
  console.log(`Local task-prefill checks: ${count} passed. Synthetic fixture only.`);
} finally {release();}
