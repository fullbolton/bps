// Dedicated synthetic local Auth/API acceptance, additive setup and guarded migration.
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
try {
  const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
  const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
  validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
  const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
  release=acquireLock();
  assert.equal(sql("SELECT obj_description(to_regclass('public.tasks'))='BPS synthetic task-prefill fixture v1' AND to_regclass('public.task_assignment_history') IS NOT NULL"),'t');
  const migration=readFileSync(new URL('../supabase/migrations/20260909001500_task_transfer.sql',import.meta.url),'utf8');
  if(sql("SELECT to_regclass('public.task_transfer_receipts') IS NULL")==='t')sql(migration);
  else{
    // Retain local receipts while testing the current draft function bodies.
    const start=migration.indexOf('CREATE FUNCTION public.task_transfer_directory('),end=migration.indexOf('REVOKE ALL ON FUNCTION public.task_transfer_directory(',start);
    assert.ok(start>0&&end>start);sql(migration.slice(start,end).replaceAll('CREATE FUNCTION public.','CREATE OR REPLACE FUNCTION public.'));
  }
  sql("NOTIFY pgrst,'reload schema';");
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
  async function user(name,role){
    const password=randomUUID()+'aA1!',email=`transfer-${randomUUID()}@example.test`;
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
    const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
    sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','${role}','${name}'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);return {uid,email,password};
  }
  const actor=await user('Devir kabul yöneticisi','yonetici'),source=await user('Devir kabul kaynak','operasyon'),target=await user('Devir kabul hedef','ik');
  let drop=false,dropped=0;
  const c=createClient(s.API_URL,s.ANON_KEY,{...options,global:{fetch:async(input,init)=>{
    const response=await fetch(input,init);const url=typeof input==='string'?input:input.url??String(input);
    if(drop&&new URL(url).pathname==='/rest/v1/rpc/transfer_tasks_scoped'){assert.equal(response.ok,true);await response.arrayBuffer();drop=false;dropped++;throw new TypeError('Test response loss after commit');}return response;
  }}});
  assert.ifError((await c.auth.signInWithPassword({email:actor.email,password:actor.password})).error);
  const scope={actorId:actor.uid,tenantId:id(1)},svc=await importActualTypeScript(new URL('../src/lib/services/task-transfer.ts',import.meta.url));
  const taskSvc=await importActualTypeScript(new URL('../src/lib/services/tasks.ts',import.meta.url));
  let count=0;const pass=label=>{count++;console.log('PASS '+label);};
  let ready=false;for(let n=0;n<20;n++){try{await svc.loadTransferDirectory(c,scope);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,200));}}assert.ok(ready);
  const create=title=>taskSvc.createTask(c,{legacyCompanyId:id(20),title,assignedToUserId:source.uid},{tenantId:id(1)});
  const t1=await create('API devir kabulü A'),t2=await create('API devir kabulü B');
  const directory=await svc.loadTransferDirectory(c,scope);assert.equal(directory.sources.find(p=>p.id===source.uid).count,2);assert.ok(directory.targets.some(p=>p.id===target.uid));pass('scoped directory measures source and target through real Auth');
  const p=await svc.loadTransferPreview(c,scope,source.uid);assert.equal(p.total,2);assert.equal(p.tasks.length,2);pass('preview returns exact count and current revisions');
  const command={commandId:randomUUID(),sourceId:source.uid,targetId:target.uid,tasks:p.tasks.map(({id,revision})=>({id,revision}))};
  drop=true;await assert.rejects(()=>svc.submitTransfer(c,scope,command));assert.equal(dropped,1);
  assert.equal(sql(`SELECT count(*) FROM tasks WHERE id IN ('${t1.id}','${t2.id}') AND assigned_to_user_id='${target.uid}' AND revision=1`),'2');pass('lost successful response still commits both transfers');
  assert.equal((await svc.submitTransfer(c,scope,command)).moved,2);assert.equal(sql(`SELECT count(*) FROM task_assignment_history WHERE task_id IN ('${t1.id}','${t2.id}') AND kind='reassigned'`),'2');pass('same command replay does not duplicate history');
  await assert.rejects(()=>svc.submitTransfer(c,scope,{...command,targetId:actor.uid}),e=>e.message==='TRANSFER_COMMAND');pass('changed command rejected');
  assert.equal((await svc.loadTransferPreview(c,scope,source.uid)).total,0);pass('remaining work is separately remeasured');
  const t3=await create('API çatışma kabulü A'),t4=await create('API çatışma kabulü B');
  const stale=await svc.loadTransferPreview(c,scope,source.uid);sql(`UPDATE tasks SET title='API değişmiş görev' WHERE id='${t4.id}';`);
  await assert.rejects(()=>svc.submitTransfer(c,scope,{...command,commandId:randomUUID(),tasks:stale.tasks.map(({id,revision})=>({id,revision}))}),e=>e.message==='TRANSFER_CONFLICT');
  assert.equal(sql(`SELECT revision FROM tasks WHERE id='${t3.id}'`),'0');pass('stale preview rolls back whole API batch');
  assert.ok((await c.from('task_transfer_receipts').select('*')).error);pass('receipt table inaccessible to authenticated client');
  sql(`UPDATE profiles SET role='ik' WHERE id='${actor.uid}'`);await assert.rejects(()=>svc.loadTransferDirectory(c,scope),e=>e.message==='TRANSFER_FORBIDDEN');sql(`UPDATE profiles SET role='yonetici' WHERE id='${actor.uid}'`);pass('live manager role required');
  // These two source tasks deliberately remain for the synthetic browser acceptance.
  sql(`UPDATE tasks SET title='Tarayıcı toplu devir A' WHERE id='${t3.id}'; UPDATE tasks SET title='Tarayıcı toplu devir B' WHERE id='${t4.id}';`);
  pass('two synthetic source tasks ready for browser preview and transfer');
  console.log(`Local task transfer checks: ${count} passed.`);
} catch(error){console.error('Local transfer acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
