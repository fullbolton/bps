// Apply only to the verified dedicated synthetic local Supabase; no env file.
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
 const workdir='/private/tmp/bps-supabase-acceptance';
 const s=JSON.parse(run('supabase',['status','--workdir',workdir,'-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync(workdir+'/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();
 const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1' AND to_regclass('public.ops_start_plans') IS NOT NULL"),'t');
 if(sql("SELECT to_regprocedure('public.ops_start_board_filtered(uuid,uuid,date,integer,text,boolean,boolean)') IS NULL")==='t')sql(readFileSync(new URL('../supabase/migrations/20260909002800_start_board_filters.sql',import.meta.url),'utf8'));
 sql("NOTIFY pgrst,'reload schema'");
 console.log('PASS 02800 present on guarded local Supabase');
 const opts={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,opts),client=createClient(s.API_URL,s.ANON_KEY,opts);
 const email=`filter-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
 const location=randomUUID(),worker=randomUUID(),request=randomUUID(),assignment=randomUUID(),name='Filter '+worker;
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Synthetic filter reader') ON CONFLICT(id) DO UPDATE SET role='yonetici';INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${uid}','${id(1)}');
  INSERT INTO ops_locations(id,tenant_id,company_id,name,city) VALUES('${location}','${id(1)}','${id(20)}','Synthetic filter branch','Istanbul');
  INSERT INTO ops_workers(id,tenant_id,name,code,kind) VALUES('${worker}','${id(1)}','${name}','${worker}','idp');
  INSERT INTO ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by) VALUES('${request}','${id(1)}','${id(20)}','${location}',(now() AT TIME ZONE 'Europe/Istanbul')::date,'Clean','Cleaner',1,'${uid}');
  INSERT INTO ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by) VALUES('${assignment}','${id(1)}','${request}',(now() AT TIME ZONE 'Europe/Istanbul')::date,'${worker}','${uid}');`);
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const day=sql("SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date");
  const args={p_actor_id:uid,p_tenant_id:id(1),p_day:day,p_search:name,p_only_mine:false,p_only_urgent:true,p_offset:0};
  let found;
  for(let i=0;i<20;i++){found=await client.rpc('ops_start_board_filtered',args);if(found.error?.code!=='PGRST202')break;await new Promise(r=>setTimeout(r,150));}
  assert.ifError(found.error);const {parseFilteredStartBoard}=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));
  const board=parseFilteredStartBoard(found.data);assert.equal(board.total,1);assert.equal(board.rows[0].id,assignment);
  const notOwned=await client.rpc('ops_start_board_filtered',{...args,p_only_mine:true});assert.ifError(notOwned.error);assert.equal(notOwned.data.total,0);
  const plan=await client.rpc('ops_start_execute',{p_actor_id:uid,p_tenant_id:id(1),p_command_id:randomUUID(),p_assignment_id:assignment,p_expected_revision:0,p_action:'plan',p_payload:{time:'08:00',responsibleId:uid,offsets:[-60]}});assert.ifError(plan.error);
  const owned=await client.rpc('ops_start_board_filtered',{...args,p_only_mine:true,p_only_urgent:false});assert.ifError(owned.error);assert.equal(owned.data.total,1);parseFilteredStartBoard(owned.data);
  assert.ok((await client.rpc('ops_start_board_filtered',{...args,p_tenant_id:id(2)})).error);
  const anon=createClient(s.API_URL,s.ANON_KEY,opts);assert.ok((await anon.rpc('ops_start_board_filtered',args)).error);
  console.log('PASS authenticated filtered read, own-responsibility transition, parser and tenant/anon rejection');
 }finally{
  sql(`DELETE FROM ops_start_events WHERE assignment_id='${assignment}';DELETE FROM ops_start_plans WHERE assignment_id='${assignment}';DELETE FROM ops_events WHERE actor_id='${uid}';DELETE FROM ops_commands WHERE actor_id='${uid}';DELETE FROM ops_assignments WHERE id='${assignment}';DELETE FROM ops_daily_requests WHERE id='${request}';DELETE FROM ops_workers WHERE id='${worker}';DELETE FROM ops_locations WHERE id='${location}';DELETE FROM tenant_memberships WHERE user_id='${uid}';DELETE FROM profiles WHERE id='${uid}'`);
  assert.ifError((await admin.auth.admin.deleteUser(uid)).error);
 }
 console.log('PASS temporary synthetic API account and records removed');
}catch(error){console.error('Start board filter local acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
