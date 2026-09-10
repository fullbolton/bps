import {mkdtemp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const {default:EmbeddedPostgres}=await import(pathToFileURL(process.env.BPS_EMBEDDED_PG_MODULE).href);
const dir=await mkdtemp(join(tmpdir(),'bps-candidate-'));const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55457,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
let c,count=0;const pass=s=>{count++;console.log('PASS '+s);};
try{
 await pg.initialise();await pg.start();c=pg.getPgClient('postgres','127.0.0.1');await c.connect();await c.query(baseline);
 await c.query("ALTER TABLE profiles ADD display_name text DEFAULT 'Synthetic';ALTER TABLE tenants ADD name text DEFAULT 'Synthetic tenant'");
 const path=new URL('../supabase/migrations/',import.meta.url),migration=await readFile(new URL('20260910000100_candidate_company_operations.sql',path),'utf8');
 await assert.rejects(()=>c.query(migration),/OPS_CANDIDATE_BASELINE_REQUIRED/);await c.query('ROLLBACK');pass('missing baseline fails before function creation');
 const files=(await readdir(path)).filter(f=>f.startsWith('20260909')&&(f.slice(0,14)<='20260909001200'||['20260909002200','20260909002500','20260909002700','20260909002800','20260909002900'].includes(f.slice(0,14)))).sort();
 for(const f of files)await c.query(await readFile(new URL(f,path),'utf8'));
 const names=['ops_import_locations','ops_create_request_batch','ops_resize_request','ops_replace_assignment_before_start','ops_set_directory_active','ops_mutate','workspace_setup'];
 const defs=async()=>(await c.query('SELECT proname,proowner,proacl::text,pg_get_functiondef(oid) def FROM pg_proc WHERE pronamespace=\'public\'::regnamespace AND proname=ANY($1) ORDER BY proname',[names])).rows;
 const before=await defs();await c.query(migration);const after=await defs();assert.equal(after.length,7);
 for(let i=0;i<before.length;i++){assert.equal(after[i].proowner,before[i].proowner);assert.equal(after[i].proacl,before[i].proacl);assert.equal(after[i].def,before[i].def.replaceAll("status='aktif'","status IN ('aday','aktif')"));}
 assert.equal((await c.query("SELECT has_function_privilege('authenticated','ops_replace_assignment_before_start(uuid,uuid,uuid,uuid,uuid,integer)','execute') allowed")).rows[0].allowed,false);pass('only status predicates change; seven owners/ACLs and private replacement stay intact');
 const as=async(u=10,t=1)=>{await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(u),id(t)]);await c.query('SET ROLE authenticated');};
 const call=async(name,args)=>(await c.query(`SELECT public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) r`,args)).rows[0].r;
 const scoped=(kind,payload,cmd=randomUUID())=>call('ops_execute_scoped',[id(10),id(1),cmd,kind,payload]);
 const status=async(s)=>{await c.query('RESET ROLE');await c.query('UPDATE companies SET status=$1 WHERE id=$2',[s,id(20)]);await as();};
 const day=(await c.query("SELECT (now() AT TIME ZONE 'Europe/Istanbul')::date::text d")).rows[0].d;
 for(const s of ['aday','aktif']){
  await status(s);
  const loc=(await scoped('location',{companyId:id(20),name:s+' branch',city:'Istanbul'})).id;
  const imported=await scoped('location_import',{companyId:id(20),rows:[{code:s,name:s+' csv',city:'Istanbul'}]});assert.equal(imported.added,1);
  const req=(await scoped('request',{companyId:id(20),locationId:loc,workDate:day,serviceLine:'Clean',position:'Cleaner',requiredCount:1})).id;
  await call('ops_create_request_batch',[id(10),id(1),randomUUID(),{companyId:id(20),locationId:loc,dates:[day],serviceLine:'Other',position:'Batch',requiredCount:1}]);
  await call('ops_resize_request',[id(10),id(1),randomUUID(),req,1,2]);
  const workers=[];for(let i=0;i<2;i++)workers.push((await scoped('worker',{name:s+i,code:s+i,kind:'idp'})).id);
  const old=(await scoped('assign',{requestId:req,workerId:workers[0]})).id;
  await call('ops_start_execute',[id(10),id(1),randomUUID(),old,0,'plan',{time:'08:00',responsibleId:id(10),offsets:[-60]}]);
  const cmd=randomUUID(),args=[id(10),id(1),cmd,old,workers[1],0];const replacement=await call('ops_replace_assignment',args);assert.deepEqual(await call('ops_replace_assignment',args),replacement);
  await c.query('RESET ROLE');
  assert.equal((await c.query('SELECT count(*)::int n FROM ops_start_events WHERE assignment_id=$1 AND kind=\'inherited\'',[cmd])).rows[0].n,1);await as();
  await call('ops_set_directory_active',[id(10),id(1),randomUUID(),'locations',loc,0,false]);await call('ops_set_directory_active',[id(10),id(1),randomUUID(),'locations',loc,1,true]);
  const setup=await call('workspace_setup',[id(10),id(1)]);assert.equal(setup.companies,1);assert.ok(setup.requests>=2);assert.ok(setup.assignments>=1);
  const board=await call('ops_board',[id(20),day]);assert.ok(board.requests.some(r=>r.id===req));
  const monday=(await c.query("SELECT date_trunc('week',$1::date)::date::text d",[day])).rows[0].d;const week=await call('ops_week',[id(20),monday]);assert.ok(week);
  const start=await call('ops_start_board_filtered',[id(10),id(1),day,0,'',false,false]);assert.ok(start.rows.some(r=>r.assignmentId===cmd||r.id===cmd));
  assert.equal((await c.query('SELECT status FROM companies WHERE id=$1',[id(20)])).rows[0].status,s);
  pass(s+': manual/CSV branches, single/batch demand, resize, assignment, replacement replay/plan, activation, reads and setup; CRM unchanged');
 }
 // Existing candidate operations remain visible and removable when company becomes ineligible.
 await status('aday');const loc=(await scoped('location',{companyId:id(20),name:'Blocked matrix',city:'Istanbul'})).id;
 const req=(await scoped('request',{companyId:id(20),locationId:loc,workDate:day,serviceLine:'Guard',position:'Guard',requiredCount:2})).id;
 const w=(await scoped('worker',{name:'Guard',code:'GUARD',kind:'idp'})).id;const w2=(await scoped('worker',{name:'Guard replacement',code:'GUARD2',kind:'idp'})).id;
 const assigned=(await scoped('assign',{requestId:req,workerId:w})).id;
 for(const s of ['pasif',null,'unknown']){
  await status(s);
  const attempts=[()=>scoped('location',{companyId:id(20),name:'Denied',city:'Istanbul'}),()=>scoped('location_import',{companyId:id(20),rows:[{code:'DENIED',name:'Denied',city:'Istanbul'}]}),()=>scoped('request',{companyId:id(20),locationId:loc,workDate:day,serviceLine:'Denied',position:'Denied',requiredCount:1}),()=>scoped('assign',{requestId:req,workerId:w2}),()=>call('ops_create_request_batch',[id(10),id(1),randomUUID(),{companyId:id(20),locationId:loc,dates:[day],serviceLine:'Denied',position:'Denied',requiredCount:1}]),()=>call('ops_resize_request',[id(10),id(1),randomUUID(),req,2,3]),()=>call('ops_replace_assignment',[id(10),id(1),randomUUID(),assigned,w2,0]),()=>call('ops_set_directory_active',[id(10),id(1),randomUUID(),'locations',loc,0,true])];
  for(const f of attempts)await assert.rejects(f,/OPS_INACTIVE_COMPANY/);
  const setup=await call('workspace_setup',[id(10),id(1)]);for(const key of ['companies','locations','requests','assignments'])assert.equal(setup[key],0);
  assert.ok((await call('ops_board',[id(20),day])).requests.some(r=>r.id===req));pass(String(s)+': eight new-operation paths blocked, setup excludes, history remains visible');
 }
 await scoped('remove',{requestId:req,assignmentId:assigned});await scoped('cancel',{requestId:req});pass('ineligible company still permits removing assignment and cancelling existing request');
 await status('aday');await as(13,2);await assert.rejects(()=>scoped('location',{companyId:id(20),name:'Foreign',city:'Istanbul'}),/OPS_SCOPE_CHANGED/);
 await as(12);await assert.rejects(()=>call('ops_execute_scoped',[id(12),id(1),randomUUID(),'location',{companyId:id(20),name:'HR',city:'Istanbul'}]),/OPS_FORBIDDEN/);
 await c.query('RESET ROLE');await c.query('SET ROLE anon');await assert.rejects(()=>call('ops_mutate',[randomUUID(),'location',{}]),/permission denied/);pass('foreign actor/tenant, HR mutation and anonymous RPC remain denied');
 console.log(`Candidate company PostgreSQL checks: ${count} passed.`);
}finally{await c?.end();await pg.stop();await rm(dir,{recursive:true,force:true});}
