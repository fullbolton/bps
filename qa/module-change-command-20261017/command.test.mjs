import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const database=`bps_module_command_${process.pid}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
async function blocked(c,pid){for(let n=0;n<100;n++){if((await c.query('select wait_event_type from pg_stat_activity where pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,20));}assert.fail('No observed lock wait');}
test('local module command candidate',async t=>{
 const clients=[];admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);
 try{
  const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
  for(let n=0;n<3;n++){let c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database,statement_timeout:8000});await c.connect();clients.push(c);await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);}
  const [a,b,o]=clients;
  const files=['20261015000500_document_cleanup_queue.sql','20261015000600_document_cleanup_retry.sql','20261015000700_document_cleanup_module_preview.sql','20261015000800_document_upload_attempts.sql','20261016000100_document_upload_module_preview.sql','20261016000200_document_pending_uploads.sql','20261016000300_document_finalize_upload.sql','20261016000400_document_upload_recovery.sql','20261016000500_document_upload_cancellation.sql','20261016000600_document_metadata_command.sql','20261016000700_document_delete_command.sql','20261016000800_document_insert_reservations.sql','20261016000900_document_storage_legacy_write_fences.sql','20261016001100_document_storage_module_barrier.sql'];
  for(const file of files)await a.query(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  await a.query(readFileSync(new URL('./command-candidate.sql',import.meta.url),'utf8'));
  const context=async c=>(await c.query('select current_workspace_modules_v1() AS value')).rows[0].value;
  const invoke=(c,ctx,command,modules)=>c.query('select change_workspace_modules_v1($1,$2,$3,$4,$5,$6,$7) AS value',[ctx.actorId,ctx.tenantId,ctx.membershipVersion,ctx.selectionVersion,ctx.configRevision,id(command),modules]);
  const selectCompany=async(c,actor,tenant,command)=>{
   await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,role:'authenticated'})]);
   const member=(await c.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[actor,tenant])).rows[0].version;
   const selected=(await c.query('select version from workspace_selections where user_id=$1',[actor])).rows[0]?.version??null;
   const choice=(await c.query('select select_workspace($1,$2,$3,$4) value',[tenant,member,id(command),selected])).rows[0].value;
   await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:actor,role:'authenticated',active_tenant_id:tenant,workspace_membership_version:choice.membershipVersion,workspace_selection_version:choice.selectionVersion})]);
  };
  await t.test('candidate remains inaccessible to client and service roles',async()=>{
   const rows=(await a.query("select r,has_function_privilege(r,'public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)','execute') allowed from unnest(array['anon','authenticated','service_role']) r")).rows;
   assert.ok(rows.every(row=>!row.allowed));
  });
  await t.test('change is atomic, replay creates no duplicate, changed payload and stale revision fail',async()=>{
   const ctx=await context(a);const draft={...ctx.modules,announcements:false};
   const first=(await invoke(a,ctx,801,draft)).rows[0].value;assert.equal(first.replayed,false);
   assert.equal((await invoke(a,ctx,801,draft)).rows[0].value.replayed,true);
   assert.equal((await context(a)).configRevision,String(BigInt(ctx.configRevision)+1n));
   await assert.rejects(invoke(a,ctx,801,{...draft,announcements:true}),{code:'22023'});
   await assert.rejects(invoke(a,ctx,802,draft),{code:'40001'});
   assert.equal((await a.query("select count(*)::int n from tenant_module_changes where command_id=$1",[id(801)])).rows[0].n,1);
  });
  await t.test('dependencies, wrong actor, stale membership and no-op cannot write',async()=>{
   const ctx=await context(a);
   await assert.rejects(invoke(a,ctx,803,{...ctx.modules,customers:false}),{code:'23514'});
   await assert.rejects(invoke(a,{...ctx,actorId:id(12)},803,ctx.modules),{code:'42501'});
   await assert.rejects(invoke(a,{...ctx,membershipVersion:id(999)},803,ctx.modules),{code:'42501'});
   await assert.rejects(invoke(a,ctx,803,ctx.modules),{code:'22023'});
   assert.equal((await context(a)).configRevision,ctx.configRevision);
  });
  await t.test('repeatable read and cross-tenant calls fail closed',async()=>{
   const ctx=await context(a);
   await assert.rejects(invoke(a,{...ctx,tenantId:id(2)},810,{...ctx.modules,announcements:true}),{code:'42501'});
   await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
   await assert.rejects(invoke(a,ctx,810,{...ctx.modules,announcements:true}),{code:'25000'});
   await a.query('ROLLBACK');
  });
  await t.test('pending document preparation prevents closing with no metadata receipt',async()=>{
   await a.query("insert into companies(id,tenant_id,name) values($1,$2,'Synthetic module check')",[id(890),id(1)]);
   await a.query("select document_prepare_upload_v1($1,$2,$3,'Synthetic','diger',NULL,10)",[id(891),id(1),id(890)]);
   const ctx=await context(a);
   await assert.rejects(invoke(a,ctx,807,{...ctx.modules,documents:false,contracts:false}),{code:'23514'});
   assert.equal((await context(a)).configRevision,ctx.configRevision);
  });
  await t.test('two concurrent sessions with the same revision cannot overwrite one another',async()=>{
   const ctx=await context(a);await a.query('BEGIN');
   await invoke(a,ctx,808,{...ctx.modules,announcements:true});
   const waiting=invoke(b,ctx,809,{...ctx.modules,finance:false}).then(()=>null,e=>e.code);
   await blocked(o,b.processID);await a.query('COMMIT');assert.equal(await waiting,'40001');
   const current=await context(a);assert.equal(current.modules.announcements,true);assert.equal(current.modules.finance,true);
  });
  await a.query("update tasks set status='tamamlandi' where tenant_id=$1",[id(1)]);
  await t.test('writer commits first: waiting close sees newly committed open task and rejects',async()=>{
   const ctx=await context(a);await a.query('BEGIN');
   await a.query("select workspace_require_module_write_v1($1,ARRAY['tasks'])",[id(1)]);
   await a.query("insert into tasks(id,tenant_id,title,status) values($1,$2,'Synthetic race','acik')",[id(880),id(1)]);
   const waiting=invoke(b,ctx,804,{...ctx.modules,tasks:false}).then(()=>null,e=>e.code);
   await blocked(o,b.processID);await a.query('COMMIT');assert.equal(await waiting,'23514');
   assert.equal((await context(a)).modules.tasks,true);
  });
  await a.query("update tasks set status='tamamlandi' where id=$1",[id(880)]);
  await t.test('close commits first: waiting business writer rejects disabled module',async()=>{
   const ctx=await context(a);await a.query('BEGIN');await invoke(a,ctx,805,{...ctx.modules,tasks:false});
   const waiting=b.query("select workspace_require_module_write_v1($1,ARRAY['tasks'])",[id(1)]).then(()=>null,e=>e.code);
   await blocked(o,b.processID);await a.query('COMMIT');assert.equal(await waiting,'BM001');
   assert.equal((await context(a)).modules.tasks,false);
  });
  await t.test('reopening preserves work and increments revision once',async()=>{
   const ctx=await context(a);await invoke(a,ctx,806,{...ctx.modules,tasks:true});
   assert.equal((await context(a)).modules.tasks,true);
   assert.equal((await a.query('select count(*)::int n from tasks where id=$1',[id(880)])).rows[0].n,1);
  });
  for(const waitingOn of ['profile','config'])await t.test(`role revoked while command waits on ${waitingOn}: no settings or receipt written`,async()=>{
   const ctx=await context(a);
   await a.query('BEGIN');
   if(waitingOn==='config')await a.query('select 1 from tenant_module_config where tenant_id=$1 for update',[id(1)]);
   await a.query('select 1 from profiles where id=$1 for update',[id(11)]);
   const waiting=invoke(b,ctx,811,{...ctx.modules,announcements:false}).then(()=>null,e=>e.code);
   await blocked(o,b.processID);
   await a.query("update tenant_memberships set role='operasyon' where user_id=$1 and tenant_id=$2",[id(11),id(1)]);
   await a.query('COMMIT');assert.equal(await waiting,'42501');
   assert.equal((await o.query('select revision::text revision from tenant_module_config where tenant_id=$1',[id(1)])).rows[0].revision,ctx.configRevision);
   assert.equal((await o.query('select count(*)::int n from tenant_module_changes where command_id=$1',[id(811)])).rows[0].n,0);
   await a.query("update tenant_memberships set role='yonetici' where user_id=$1 and tenant_id=$2",[id(11),id(1)]);
   // Even with the role restored, the old membership generation cannot authorize a command.
   await assert.rejects(invoke(b,ctx,811,{...ctx.modules,announcements:false}),{code:'42501'});
  });
  await t.test('different managers serialize by tenant and cannot replay another actor receipt',async()=>{
   await a.query("insert into tenant_memberships(user_id,tenant_id,role) values($1,$2,'yonetici')",[id(12),id(1)]);
   const first=await context(a);
   await b.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(12),active_tenant_id:id(1),role:'authenticated'})]);
   await selectCompany(b,id(12),id(1),816);
   const second=await context(b);
   await a.query('BEGIN');await invoke(a,first,812,{...first.modules,announcements:false});
   const waiting=invoke(b,second,813,{...second.modules,finance:false}).then(()=>null,e=>e.code);
   await blocked(o,b.processID);await a.query('COMMIT');assert.equal(await waiting,'40001');
   const fresh=await context(b);
   await assert.rejects(invoke(b,fresh,812,{...fresh.modules,announcements:true}),{code:'22023'});
   assert.equal(fresh.modules.announcements,false);assert.equal(fresh.modules.finance,true);
   await b.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);
  });
  await t.test('workspace selection commits during profile wait: old company command is rejected',async()=>{
   await a.query("insert into tenant_memberships(user_id,tenant_id,role) values($1,$2,'yonetici')",[id(11),id(2)]);
   await selectCompany(a,id(11),id(1),817);
   const freshClaims=(await a.query("select current_setting('request.jwt.claims') value")).rows[0].value;
   await b.query("select set_config('request.jwt.claims',$1,false)",[freshClaims]);
   const ctx=await context(a);
   const membership=(await a.query('select version from tenant_memberships where user_id=$1 and tenant_id=$2',[id(11),id(2)])).rows[0].version;
   await a.query('BEGIN');await a.query('select 1 from profiles where id=$1 for update',[id(11)]);
   const waiting=invoke(b,ctx,814,{...ctx.modules,announcements:true}).then(()=>null,e=>e.code);
   await blocked(o,b.processID);
   await a.query('select select_workspace($1,$2,$3,$4)',[id(2),membership,id(815),ctx.selectionVersion]);
   await a.query('COMMIT');assert.equal(await waiting,'42501');
   assert.equal((await o.query('select revision::text revision from tenant_module_config where tenant_id=$1',[id(1)])).rows[0].revision,ctx.configRevision);
   assert.equal((await o.query('select count(*)::int n from tenant_module_changes where command_id=$1',[id(814)])).rows[0].n,0);
  });
 }finally{await Promise.all(clients.map(c=>c.end()));admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
