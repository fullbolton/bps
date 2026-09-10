/** Cross-module acceptance. Dedicated local synthetic Supabase only; no production or email. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local command failed');}};
const httpOrigin=process.env.BPS_PILOT_HTTP_ORIGIN??'http://127.0.0.1:3000';
assert.ok(['http://127.0.0.1:3000','http://127.0.0.1:3010'].includes(httpOrigin),'Only dedicated loopback web ports are allowed');
const output=mkdtempSync('/private/tmp/bps-sector-pilot-'),checks=[];
const pass=(label,evidence={})=>{checks.push({label,...evidence});console.log('PASS '+label);};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();
 const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1' AND strpos(pg_get_functiondef('public.ops_mutate(uuid,text,jsonb)'::regprocedure),$$status IN ('aday','aktif')$$)>0"),'t');
 // Warm the actual route before creating any accounts; a missing dev server is an environment failure.
 const ready=await fetch(httpOrigin+'/api/operations/weekly-export',{redirect:'manual',signal:AbortSignal.timeout(20000)});
 assert.equal(ready.status,307,'Local unauthenticated export route must redirect before fixtures are created');
 const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
 const email=`sector-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id,bank=randomUUID(),hotel=randomUUID(),workers=[];
 assert.match(uid,/^[0-9a-f-]{36}$/);
 const owned=`'${bank}','${hotel}'`;
 writeFileSync(output+'/owned.json',JSON.stringify({uid,bank,hotel,environment:'dedicated_local'}),{mode:0o600});
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Sector pilot acceptance');INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${uid}','${id(1)}');INSERT INTO companies(id,tenant_id,name,status) VALUES('${bank}','${id(1)}','Sentetik Kent Bankası','aday'),('${hotel}','${id(1)}','Sentetik Sahil Oteli','aktif');`);
  const jar=new Map();const c=createServerClient(s.API_URL,s.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
  assert.ifError((await c.auth.signInWithPassword({email,password})).error);
  const service=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
  const week=await importActualTypeScript(new URL('../src/lib/operations/weekly-plan.ts',import.meta.url));
  const imports=await importActualTypeScript(new URL('../src/lib/operations/location-import.ts',import.meta.url));
  const boardParser=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));
  const attendance=await importActualTypeScript(new URL('../src/lib/operations/weekly-attendance.ts',import.meta.url));
  const scope={actorId:uid,tenantId:id(1)},args={p_actor_id:uid,p_tenant_id:id(1)};
  const rpc=async(name,payload)=>{const r=await c.rpc(name,payload);assert.ifError(r.error);return r.data;};
  const mutate=(kind,payload,command=randomUUID())=>service.runPilotCommand(c,command,kind,payload,scope);
  const day=sql("SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date"),start=week.weekStart(day);
  const days=[day,...Array.from({length:7},(_,i)=>week.addDays(start,i)).filter(d=>d!==day)].slice(0,3).sort();
  const csv='sube_kodu;sube_adi;il\nIST;Kadıköy;İstanbul\nANK;Çankaya;Ankara\nIZM;Konak;İzmir\n';
  const rows=imports.parseLocationCsv(csv),command=randomUUID();
  assert.deepEqual(await service.runLocationImport(c,command,bank,rows,scope),{added:3,skipped:0});
  assert.deepEqual(await service.runLocationImport(c,command,bank,rows,scope),{added:3,skipped:0});
  assert.deepEqual(await service.runLocationImport(c,randomUUID(),bank,rows,scope),{added:0,skipped:3});
  let board=await service.loadPilotBoard(c,bank,day);assert.equal(board.locations.length,3);
  pass('bank: CSV three branches, receipt replay and fresh-command import without duplicates');
  for(const l of board.locations)await service.runRequestBatch(c,scope,randomUUID(),{companyId:bank,locationId:l.id,serviceLine:'Temizlik',position:'Temizlik görevlisi',requiredCount:1,dates:days});
  const makeWorker=async(name)=>{const worker=randomUUID();workers.push(worker);await mutate('worker',{name,code:worker,kind:'idp'},worker);return worker;};
  const bankWorker=await makeWorker('Sentetik banka personeli');
  let bp=await service.loadPilotWeek(c,bank,day);assert.equal(bp.requests.length,9);
  const branch=board.locations[0].id;
  let bankToday;
  for(const r of bp.requests.filter(r=>r.locationId===branch)){const a=await mutate('assign',{requestId:r.id,workerId:bankWorker});if(r.workDate===day)bankToday=a.id;}
  const other=bp.requests.find(r=>r.workDate===day&&r.locationId!==branch);
  await assert.rejects(mutate('assign',{requestId:other.id,workerId:bankWorker}),e=>e.message.includes('OPS_WORKER_CONFLICT'));
  bp=await service.loadPilotWeek(c,bank,day);assert.deepEqual(week.weeklyTotals(bp.requests),{requests:9,cancelled:0,required:9,assigned:3,open:6});
  for(const d of days){const daily=await service.loadPilotBoard(c,bank,d);assert.deepEqual(week.weeklyTotals(daily.requests),{requests:3,cancelled:0,required:3,assigned:1,open:2});}
  pass('bank: nine person-days, three placements, six open; same-day double booking rejected',{requests:9,required:9,assigned:3,open:6});
  const startEvent=(assignment,revision,action,payload,command=randomUUID())=>rpc('ops_start_execute',{...args,p_command_id:command,p_assignment_id:assignment,p_expected_revision:revision,p_action:action,p_payload:payload});
  await startEvent(bankToday,0,'plan',{time:'08:00',responsibleId:uid,offsets:[-60,-30,-15]});
  await startEvent(bankToday,1,'call',{offset:0,outcome:'claimed_arrival',occurredAt:new Date().toISOString()});
  const readStart=async(client=c)=>{const r=await client.rpc('ops_start_board_filtered',{...args,p_day:day,p_offset:0,p_search:'Sentetik banka personeli',p_only_mine:false,p_only_urgent:false});assert.ifError(r.error);return boardParser.parseFilteredStartBoard(r.data).rows.find(r=>r.id===bankToday);};
  assert.equal((await readStart()).confirmedAt,null);
  const confirmation=randomUUID(),at=new Date().toISOString(),payload={source:'branch',witness:'Sentetik şube teyidi',occurredAt:at};
  const confirmed=await startEvent(bankToday,2,'confirm',payload,confirmation);assert.deepEqual(await startEvent(bankToday,2,'confirm',payload,confirmation),confirmed);
  const fresh=createClient(s.API_URL,s.ANON_KEY,options);assert.ifError((await fresh.auth.signInWithPassword({email,password})).error);const freshRow=await readStart(fresh);assert.equal(freshRow.attendance,'present');assert.equal(freshRow.events.filter(e=>e.kind==='confirm').length,1);
  pass('bank: claim is not confirmation; independent confirmation replay and fresh-session persistence');
  const hl=(await mutate('location',{companyId:hotel,name:'Sentetik otel ana bina',city:'Antalya'})).id;
  const hDays=[day,days.find(d=>d!==day)].sort();
  await service.runRequestBatch(c,scope,randomUUID(),{companyId:hotel,locationId:hl,serviceLine:'Servis',position:'Garson',requiredCount:2,dates:hDays});
  let hp=await service.loadPilotWeek(c,hotel,day);const todayRequest=hp.requests.find(r=>r.workDate===day),second=hp.requests.find(r=>r.workDate!==day);
  await mutate('resize',{requestId:second.id,expectedCount:2,requiredCount:3});
  const first=await makeWorker('Sentetik gelmeyen personel'),secondWorker=await makeWorker('Sentetik ikinci personel'),backup=await makeWorker('Sentetik yedek personel');
  let oldAssignment;
  for(const r of hp.requests)for(const w of [first,secondWorker]){const a=await mutate('assign',{requestId:r.id,workerId:w});if(r.id===todayRequest.id&&w===first)oldAssignment=a.id;}
  await startEvent(oldAssignment,0,'plan',{time:'08:00',responsibleId:uid,offsets:[-60]});
  await mutate('attendance',{assignmentId:oldAssignment,expectedRevision:0,status:'absent'});
  const recorded=sql(`SELECT attendance_recorded_at FROM ops_assignments WHERE id='${oldAssignment}'`);
  const replacement=randomUUID(),replacementPayload={assignmentId:oldAssignment,workerId:backup,expectedRevision:1};
  const replaced=await mutate('replace',replacementPayload,replacement);assert.deepEqual(await mutate('replace',replacementPayload,replacement),replaced);
  await startEvent(replaced.id,1,'confirm',{source:'field',witness:'Sentetik saha teyidi',occurredAt:new Date().toISOString()});
  hp=await service.loadPilotWeek(c,hotel,day);assert.deepEqual(week.weeklyTotals(hp.requests),{requests:2,cancelled:0,required:5,assigned:4,open:1});
  for(const d of hDays){const daily=await service.loadPilotBoard(c,hotel,d);assert.deepEqual(week.weeklyTotals(daily.requests),{requests:1,cancelled:0,required:d===day?2:3,assigned:2,open:d===day?0:1});}
  const history=await service.loadAttendanceWeek(c,hotel,day);const old=history.requests.flatMap(r=>r.attendance).find(a=>a.id===oldAssignment);assert.equal(old.status,'absent');assert.equal(old.removed,true);assert.equal(sql(`SELECT attendance_recorded_at FROM ops_assignments WHERE id='${oldAssignment}'`),recorded);
  assert.deepEqual(attendance.attendanceTotals(history.requests),{present:1,absent:1,unreported:3,cancelledPresent:0});
  pass('hotel: capacities 2/3, replacement replay, preserved absence timestamp and inherited start plan confirmation',{required:5,assigned:4,open:1,present:1,absent:1,unreported:3});
  for(const [name,company,expected] of [['bank',bank,[9,9,3,6]],['hotel',hotel,[2,5,4,1]]]){
   const response=await fetch(`${httpOrigin}/api/operations/weekly-export?company=${company}&date=${day}&cancelled=0`,{headers:{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},redirect:'manual',signal:AbortSignal.timeout(20000)});
   assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment;/);
   const file=output+'/'+name+'.csv';writeFileSync(file,Buffer.from(await response.arrayBuffer()),{mode:0o600});
   run('python3',['-c',"import csv,sys,json\nr=list(csv.DictReader(open(sys.argv[1],encoding='utf-8-sig',newline=''),delimiter=';'))\ne=json.loads(sys.argv[2])\nassert all(x['Firma']==sys.argv[3] for x in r)\nassert [len(r),sum(int(x['Talep edilen kişi']) for x in r),sum(int(x['Atanan kişi']) for x in r),sum(int(x['Aktif açık']) for x in r)]==e",file,JSON.stringify(expected),name==='bank'?'Sentetik Kent Bankası':'Sentetik Sahil Oteli']);
   pass(name+': real loopback CSV attachment and independent decoded totals',{expected});
  }
  if(process.env.BPS_PILOT_BROWSER==='1'){
   const {acceptSectorBrowser}=await import('./qa-local-sector-browser.mjs');
   await acceptSectorBrowser({origin:httpOrigin,jar,bank,hotel,day,requestId:todayRequest.id,output,pass});
  }
  const denied=await c.rpc('ops_execute_scoped',{...args,p_tenant_id:id(2),p_command_id:randomUUID(),p_kind:'location',p_payload:{companyId:bank,name:'Denied',city:'Istanbul'}});assert.ok(denied.error);
  sql(`UPDATE profiles SET role='ik' WHERE id='${uid}'`);await assert.rejects(service.loadPilotWeek(c,bank,day));
  pass('foreign tenant and current role loss rejected with existing session');
 }finally{
  sql(`BEGIN;DELETE FROM ops_start_events WHERE assignment_id IN (SELECT a.id FROM ops_assignments a JOIN ops_daily_requests r ON r.id=a.request_id WHERE r.company_id IN (${owned}));DELETE FROM ops_start_plans WHERE assignment_id IN (SELECT a.id FROM ops_assignments a JOIN ops_daily_requests r ON r.id=a.request_id WHERE r.company_id IN (${owned}));DELETE FROM ops_events WHERE actor_id='${uid}';DELETE FROM ops_commands WHERE actor_id='${uid}';DELETE FROM ops_assignments WHERE request_id IN (SELECT id FROM ops_daily_requests WHERE company_id IN (${owned}));DELETE FROM ops_daily_requests WHERE company_id IN (${owned});DELETE FROM ops_locations WHERE company_id IN (${owned});${workers.map(w=>`DELETE FROM ops_workers WHERE id='${w}';`).join('')}DELETE FROM companies WHERE id IN (${owned});DELETE FROM tenant_memberships WHERE user_id='${uid}';DELETE FROM profiles WHERE id='${uid}';COMMIT;`);
  assert.ifError((await admin.auth.admin.deleteUser(uid)).error);assert.equal(sql(`SELECT count(*) FROM companies WHERE id IN (${owned})`),'0');pass('owned synthetic records and account cleaned');
 }
 writeFileSync(output+'/report.json',JSON.stringify({status:'passed',environment:'dedicated_local',checks,production:false,browserAcceptance:process.env.BPS_PILOT_BROWSER==='1'},null,2)+'\n',{mode:0o600});console.log('Evidence: '+output);
}catch(e){console.error('Sector pilot failed: '+e.message);process.exitCode=1;}
finally{release?.();}
