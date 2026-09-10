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

 const migration=readFileSync(new URL('../supabase/migrations/20260909002700_start_tracking.sql',import.meta.url),'utf8');
 if(sql("SELECT to_regclass('public.ops_start_plans') IS NULL")==='t')sql(migration);
 if(sql("SELECT strpos(pg_get_functiondef('public.ops_start_execute(uuid,uuid,uuid,uuid,integer,text,jsonb)'::regprocedure),'v_occurred<date_trunc')>0")!=='t')sql(readFileSync(new URL('../supabase/migrations/20260909002900_start_event_validation.sql',import.meta.url),'utf8'));
 sql("NOTIFY pgrst,'reload schema';");
 console.log('PASS 02700 + 02900 present on guarded local Supabase');
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options),c=createClient(s.API_URL,s.ANON_KEY,options);
 const email=`start-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
 const worker=randomUUID(),location=randomUUID(),request=randomUUID(),assignment=randomUUID();
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Başlama kabul kullanıcısı'); INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${uid}','${id(1)}');`);
  sql(`INSERT INTO ops_locations(id,tenant_id,company_id,name,city) VALUES('${location}','${id(1)}','${id(20)}','Start acceptance branch','Istanbul');INSERT INTO ops_workers(id,tenant_id,name,code,kind) VALUES('${worker}','${id(1)}','Start acceptance worker','${worker}','idp');INSERT INTO ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by) VALUES('${request}','${id(1)}','${id(20)}','${location}',(now() AT TIME ZONE 'Europe/Istanbul')::date,'Clean','Cleaner',1,'${uid}');INSERT INTO ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by) VALUES('${assignment}','${id(1)}','${request}',(now() AT TIME ZONE 'Europe/Istanbul')::date,'${worker}','${uid}');`);
  assert.ifError((await c.auth.signInWithPassword({email,password})).error);
  const args={p_actor_id:uid,p_tenant_id:id(1)};
  const pending=await importActualTypeScript(new URL('../src/lib/operations/pending-commands.ts',import.meta.url));
  const failure=await importActualTypeScript(new URL('../src/lib/operations/start-failure.ts',import.meta.url));
  const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},locks={request:async(_key,fn)=>fn()},identity={actorId:uid,tenantId:id(1)};
  const badPayload={time:'08:00',responsibleId:uid,offsets:[-60,-60]};
  const badId=await pending.reserveCommand(identity,'start',{assignmentId:assignment,expectedRevision:0,action:'plan',data:badPayload},storage,locks);
  const bad=await c.rpc('ops_start_execute',{...args,p_command_id:badId,p_assignment_id:assignment,p_expected_revision:0,p_action:'plan',p_payload:badPayload});
  assert.equal(bad.error?.code,'P0001');assert.equal(bad.error?.message,'START_INPUT');
  const resolution=await failure.settleStartFailure(bad.error,badId,identity,storage,locks,async ids=>{const r=await c.rpc('ops_reconcile_commands',{...args,p_command_ids:ids,p_close:true});assert.ifError(r.error);return r.data;});
  assert.equal(resolution.state,'closed');assert.equal(pending.pendingCommandIds(identity,storage).length,0);
  console.log('PASS real rejected plan is reconciled as closed and pending identity removed');

  const cmd={...args,p_command_id:randomUUID(),p_assignment_id:assignment,p_expected_revision:0,p_action:'plan',p_payload:{time:'08:00',responsibleId:uid,offsets:[-60,-30,-15]}};
  sql(`UPDATE ops_assignments SET created_at=now()-interval '2 minutes' WHERE id='${assignment}'`);
  let response;for(let i=0;i<20;i++){response=await c.rpc('ops_start_execute',cmd);if(!response.error)break;await new Promise(r=>setTimeout(r,150));}assert.ifError(response.error);
  assert.ifError((await c.rpc('ops_start_execute',{...cmd,p_command_id:randomUUID(),p_expected_revision:1,p_action:'call',p_payload:{offset:0,outcome:'claimed_arrival',occurredAt:new Date(Date.now()-60000).toISOString()}})).error);
  const confirm={...cmd,p_command_id:randomUUID(),p_expected_revision:2,p_action:'confirm',p_payload:{source:'branch',witness:'Synthetic supervisor',occurredAt:new Date(Date.now()-60000).toISOString()}};
  const first=await c.rpc('ops_start_execute',confirm);assert.ifError(first.error);
  // A fresh client represents reload/re-login, without relying on prior in-memory state.
  const second=createClient(s.API_URL,s.ANON_KEY,options);assert.ifError((await second.auth.signInWithPassword({email,password})).error);
  const replay=await second.rpc('ops_start_execute',confirm);assert.ifError(replay.error);assert.deepEqual(replay.data,first.data);
  assert.equal(sql(`SELECT attendance FROM ops_assignments WHERE id='${assignment}'`),'present');assert.equal(sql(`SELECT count(*) FROM ops_start_events WHERE assignment_id='${assignment}' AND kind='confirm'`),'1');
  const day=sql("SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date");const result=await second.rpc('ops_start_board',{...args,p_day:day,p_offset:0});assert.ifError(result.error);
  const parser=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));parser.parseStartBoard(result.data);
  console.log('PASS authenticated plan/call/confirmation persists and fresh-client retry has one event');
  assert.ok((await second.rpc('ops_start_board',{...args,p_tenant_id:id(2),p_day:day})).error);
  const anon=createClient(s.API_URL,s.ANON_KEY,options);assert.ok((await anon.rpc('ops_start_board',{...args,p_day:day})).error);
  console.log('PASS real API rejects foreign tenant and anonymous reads');
 }finally{
  sql(`DELETE FROM ops_start_events WHERE assignment_id='${assignment}';DELETE FROM ops_start_plans WHERE assignment_id='${assignment}';DELETE FROM ops_events WHERE actor_id='${uid}';DELETE FROM ops_commands WHERE actor_id='${uid}';DELETE FROM ops_assignments WHERE id='${assignment}';DELETE FROM ops_daily_requests WHERE id='${request}';DELETE FROM ops_workers WHERE id='${worker}';DELETE FROM ops_locations WHERE id='${location}';DELETE FROM tenant_memberships WHERE user_id='${uid}';DELETE FROM profiles WHERE id='${uid}'`);
  assert.ifError((await root.auth.admin.deleteUser(uid)).error);
 }
}catch(error){console.error('Start tracking local apply failed: '+error.message);process.exitCode=1;}
finally{release?.();}
