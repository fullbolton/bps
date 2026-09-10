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

 sql(readFileSync(new URL('../supabase/migrations/20260910000100_candidate_company_operations.sql',import.meta.url),'utf8'));
 sql("NOTIFY pgrst,'reload schema';");
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options),c=createClient(s.API_URL,s.ANON_KEY,options);
 const email=`candidate-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id,company=randomUUID(),commands=[],workers=[];
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Candidate acceptance');INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${uid}','${id(1)}');INSERT INTO companies(id,tenant_id,name,status) VALUES('${company}','${id(1)}','Candidate acceptance','aday');`);
  assert.ifError((await c.auth.signInWithPassword({email,password})).error);
  const scope={p_actor_id:uid,p_tenant_id:id(1)};
  const rpc=async(name,args)=>{const r=await c.rpc(name,args);assert.ifError(r.error);return r.data;};
  const mutate=async(kind,payload)=>{const cmd=randomUUID();commands.push(cmd);return rpc('ops_execute_scoped',{...scope,p_command_id:cmd,p_kind:kind,p_payload:payload});};
  const service=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
  assert.equal((await service.listPilotCompanies(c)).find(r=>r.id===company)?.active,true);
  const before=await rpc('workspace_setup',scope);
  const location=(await mutate('location',{companyId:company,name:'Candidate branch',city:'Istanbul'})).id;
  assert.equal((await mutate('location_import',{companyId:company,rows:[{code:'CSV001',name:'Candidate CSV',city:'Istanbul'}]})).added,1);
  const worker=(await mutate('worker',{name:'Candidate worker',code:randomUUID(),kind:'idp'})).id;workers.push(worker);
  const day=sql("SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date");
  const request=(await mutate('request',{companyId:company,locationId:location,workDate:day,serviceLine:'Clean',position:'Cleaner',requiredCount:2})).id;
  const assignment=(await mutate('assign',{requestId:request,workerId:worker})).id;
  const plan={...scope,p_command_id:randomUUID(),p_assignment_id:assignment,p_expected_revision:0,p_action:'plan',p_payload:{time:'08:00',responsibleId:uid,offsets:[-60]}};
  await rpc('ops_start_execute',plan);
  const occurredAt=new Date().toISOString();await rpc('ops_start_execute',{...plan,p_command_id:randomUUID(),p_expected_revision:1,p_action:'call',p_payload:{offset:0,outcome:'claimed_arrival',occurredAt}});
  const confirm={...plan,p_command_id:randomUUID(),p_expected_revision:2,p_action:'confirm',p_payload:{source:'branch',witness:'Synthetic branch witness',occurredAt}};
  const first=await rpc('ops_start_execute',confirm);assert.deepEqual(await rpc('ops_start_execute',confirm),first);
  const fresh=createClient(s.API_URL,s.ANON_KEY,options);assert.ifError((await fresh.auth.signInWithPassword({email,password})).error);
  const read=await fresh.rpc('ops_start_board_filtered',{...scope,p_day:day,p_offset:0,p_search:'Candidate worker',p_only_mine:false,p_only_urgent:false});assert.ifError(read.error);
  const parser=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));
  const row=parser.parseFilteredStartBoard(read.data).rows.find(r=>r.id===assignment);assert.ok(row?.confirmedAt);assert.equal(row.attendance,'present');assert.equal(row.events.filter(e=>e.kind==='confirm').length,1);
  const after=await rpc('workspace_setup',scope);assert.equal(after.locations-before.locations,2);assert.equal(after.requests-before.requests,1);assert.equal(after.assignments-before.assignments,1);
  assert.equal(sql(`SELECT status FROM companies WHERE id='${company}'`),'aday');
  console.log('PASS real local Auth: candidate selectable, manual/CSV branches, request, assignment, plan/call/confirm/replay, fresh-client read, setup deltas and unchanged CRM');
  sql(`UPDATE companies SET status='pasif' WHERE id='${company}'`);
  assert.equal((await service.listPilotCompanies(c)).find(r=>r.id===company)?.active,false);
  const denied=await c.rpc('ops_execute_scoped',{...scope,p_command_id:randomUUID(),p_kind:'location',p_payload:{companyId:company,name:'Denied branch',city:'Istanbul'}});assert.equal(denied.error?.message,'OPS_INACTIVE_COMPANY');
  assert.ok((await service.loadPilotBoard(c,company,day)).requests.some(r=>r.id===request));
  console.log('PASS real local API: passive company rejects new work and retains history');
 }finally{
  sql(`DELETE FROM ops_start_events WHERE tenant_id='${id(1)}' AND assignment_id IN (SELECT a.id FROM ops_assignments a JOIN ops_daily_requests r ON r.id=a.request_id WHERE r.company_id='${company}');DELETE FROM ops_start_plans WHERE tenant_id='${id(1)}' AND assignment_id IN (SELECT a.id FROM ops_assignments a JOIN ops_daily_requests r ON r.id=a.request_id WHERE r.company_id='${company}');DELETE FROM ops_events WHERE actor_id='${uid}';DELETE FROM ops_commands WHERE actor_id='${uid}';DELETE FROM ops_assignments WHERE request_id IN (SELECT id FROM ops_daily_requests WHERE company_id='${company}');DELETE FROM ops_daily_requests WHERE company_id='${company}';DELETE FROM ops_locations WHERE company_id='${company}';${workers.map(w=>`DELETE FROM ops_workers WHERE id='${w}';`).join('')}DELETE FROM companies WHERE id='${company}';DELETE FROM tenant_memberships WHERE user_id='${uid}';DELETE FROM profiles WHERE id='${uid}';`);
  assert.ifError((await root.auth.admin.deleteUser(uid)).error);console.log('PASS temporary synthetic account and business records cleaned');
 }
}catch(error){console.error('Candidate local apply failed: '+error.message);process.exitCode=1;}
finally{release?.();}
