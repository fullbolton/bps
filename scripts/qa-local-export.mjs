/** Real loopback download route acceptance; only dedicated synthetic Supabase.
 * Each run owns its account/company/workers; finally removes all of those records.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';import {createServerClient} from '@supabase/ssr';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local command failed');}};
const output=mkdtempSync('/private/tmp/bps-weekly-export-'),week='2026-09-28';
let release,count=0;const pass=label=>{count++;console.log('PASS '+label);};
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1' AND strpos(pg_get_functiondef('public.ops_mutate(uuid,text,jsonb)'::regprocedure),$$status IN ('aday','aktif')$$)>0"),'t');
 const admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const email=`export-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id,company=randomUUID(),worker=randomUUID(),location=randomUUID();
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','CSV acceptance');INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${uid}','${id(1)}');INSERT INTO companies(id,tenant_id,name,status) VALUES('${company}','${id(1)}','CSV aday şirketi','aday');`);
  const jar=new Map();
  const client=createServerClient(s.API_URL,s.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
  assert.ifError((await client.auth.signInWithPassword({email,password})).error);
  const services=await importActualTypeScript(new URL('../src/lib/services/daily-operations.ts',import.meta.url));
  const scope={actorId:uid,tenantId:id(1)};
  await services.runPilotCommand(client,location,'location',{companyId:company,name:'=CSV; "Şube"',city:'İzmir'},scope);
  await services.runPilotCommand(client,worker,'worker',{name:'Çağrı "Öztürk"',code:worker,kind:'idp'},scope);
  await services.runRequestBatch(client,scope,randomUUID(),{companyId:company,locationId:location,serviceLine:'Temizlik',position:'CSV route',requiredCount:2,dates:[week,'2026-09-29','2026-09-30']});
  const plan=await services.loadPilotWeek(client,company,week);
  for(const r of plan.requests.slice(0,2))await services.runPilotCommand(client,randomUUID(),'assign',{requestId:r.id,workerId:worker},scope);
  await services.runPilotCommand(client,randomUUID(),'cancel',{requestId:plan.requests[2].id},scope);
  await services.runPilotCommand(client,randomUUID(),'request',{companyId:company,locationId:location,workDate:'2026-10-05',serviceLine:'Other week',position:'EXCLUDED_NEXT_WEEK',requiredCount:1},scope);
  const headers={Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')};
  const endpoint='http://127.0.0.1:3000/api/operations/weekly-export?company='+company+'&date='+week+'&cancelled=0';
  const get=(url=endpoint,init={})=>fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(20000),...init});
  for(const includeCancelled of [false,true]){
   const response=await get(endpoint.replace('cancelled=0','cancelled='+(includeCancelled?'1':'0')));
   assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment; filename="personel-plani-2026-09-28-[a-f0-9]{8}\.csv"$/);
   assert.match(response.headers.get('cache-control'),/no-store/);assert.match(response.headers.get('content-type'),/^text\/csv; charset=utf-8$/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');
   const csv=bytes.toString('utf8');assert.ok(csv.includes('"\'=CSV; ""Şube"""'));assert.ok(csv.includes('"Çağrı ""Öztürk"""'));assert.ok(!csv.includes('EXCLUDED_NEXT_WEEK'));assert.equal(csv.includes('"İptal"'),includeCancelled);
   const path=output+(includeCancelled?'/including-cancelled.csv':'/active.csv');writeFileSync(path,bytes,{mode:0o600});
   // Independent standard CSV decoder verifies real response bytes, not a second call to weeklyCsv.
   run('python3',['-c',`import csv,sys\nwith open(sys.argv[1],encoding='utf-8-sig',newline='') as f: rows=list(csv.DictReader(f,delimiter=';'))\nassert len(rows)==int(sys.argv[2])\nassert all(r['Firma']=='CSV aday şirketi' and r['Şube']==\"'=CSV; \\\"Şube\\\"\" for r in rows)\nactive=[r for r in rows if r['Durum']=='Aktif']\nassert len(active)==2\nassert sum(int(r['Talep edilen kişi']) for r in active)==4\nassert sum(int(r['Atanan kişi']) for r in active)==2\nassert sum(int(r['Aktif açık']) for r in active)==2\nassert all(r['Atanan personel']=='Çağrı \\\"Öztürk\\\"' for r in active)\nassert all(r['Aktif açık']=='0' for r in rows if r['Durum']=='İptal')`,path,includeCancelled?'3':'2']);
   pass((includeCancelled?'including cancellations':'active only')+': real attachment, scope, Unicode/quotes/formula, person-day totals and seven-day boundary');
  }
  const anon=await get(endpoint,{headers:{}});assert.equal(anon.status,307);assert.match(anon.headers.get('location'),/\/login/);pass('anonymous download redirects without CSV');
  for(const [label,url] of [['foreign tenant',endpoint.replace(company,id(21))],['invalid company',endpoint.replace(company,'invalid')],['empty week',endpoint.replace(week,'2035-01-01')]]){
   const r=await get(url);assert.equal(r.status,400);assert.equal(r.headers.get('content-disposition'),null);assert.match(r.headers.get('cache-control'),/no-store/);pass(label+' cannot produce an attachment');
  }
  sql(`UPDATE profiles SET role='ik' WHERE id='${uid}'`);let r=await get();assert.equal(r.status,400);assert.equal(r.headers.get('content-disposition'),null);pass('current database role loss blocks download despite existing cookie');
  sql(`UPDATE profiles SET role='yonetici' WHERE id='${uid}';DELETE FROM tenant_memberships WHERE user_id='${uid}'`);r=await get();assert.ok([307,400].includes(r.status));assert.equal(r.headers.get('content-disposition'),null);pass('membership loss blocks download despite stale tenant claim');
 }finally{
  sql(`DELETE FROM ops_events WHERE actor_id='${uid}';DELETE FROM ops_commands WHERE actor_id='${uid}';DELETE FROM ops_assignments WHERE request_id IN (SELECT id FROM ops_daily_requests WHERE company_id='${company}');DELETE FROM ops_daily_requests WHERE company_id='${company}';DELETE FROM ops_locations WHERE company_id='${company}';DELETE FROM ops_workers WHERE id='${worker}';DELETE FROM companies WHERE id='${company}';DELETE FROM tenant_memberships WHERE user_id='${uid}';DELETE FROM profiles WHERE id='${uid}';`);
  assert.ifError((await admin.auth.admin.deleteUser(uid)).error);
  assert.equal(sql(`SELECT count(*) FROM companies WHERE id='${company}'`),'0');pass('owned synthetic account and business records cleaned');
 }
 writeFileSync(output+'/report.json',JSON.stringify({checks:count,status:'passed',week,environment:'dedicated_local',csv:['active.csv','including-cancelled.csv']},null,2)+'\n',{mode:0o600});
 console.log(`${count} local HTTP export checks passed. Evidence: ${output}`);
}catch(error){console.error('Local export acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
