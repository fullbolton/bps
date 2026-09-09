// Disposable native PostgreSQL: exact migration, real row locks, no production access.
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {baseline,id} from './fixtures/daily-operations.mjs';
const modulePath=process.env.BPS_EMBEDDED_PG_MODULE;if(!modulePath?.startsWith('/'))throw Error('Absolute BPS_EMBEDDED_PG_MODULE required');
const {default:EmbeddedPostgres}=await import(pathToFileURL(modulePath).href);
const dir=await mkdtemp(join(tmpdir(),'bps-renewal-'));
const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port:55444,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
const clients=[];let count=0;const pass=label=>{count++;console.log('PASS '+label);};
try{
 await pg.initialise();await pg.start();
 async function connect(){const c=pg.getPgClient('postgres','127.0.0.1');clients.push(c);await c.connect();await c.query("SET statement_timeout='8s'; SET idle_in_transaction_session_timeout='15s'");return c;}
 const m=await connect(),a=await connect(),b=await connect();await m.query(baseline);
 await m.query(`CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('app_metadata',jsonb_build_object('active_tenant',current_setting('test.tenant',true))) $$;
 CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid);CREATE TABLE auth.refresh_tokens(id uuid PRIMARY KEY,session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE);`);
 for(const file of ['./fixtures/local-task-prefill.sql','./fixtures/local-contracts.sql','../supabase/migrations/20260909001300_task_assignment_history.sql','../supabase/migrations/20260909001500_task_transfer.sql','./fixtures/local-admin-assignment.sql'])await m.query(await readFile(new URL(file,import.meta.url),'utf8'));
 const old=await readFile(new URL('../supabase/migrations/20260827000400_platform_admin_rpcs.sql',import.meta.url),'utf8'),start=old.indexOf('CREATE OR REPLACE FUNCTION public.admin_assign_role_and_tenant('),end=old.indexOf('COMMENT ON FUNCTION public.admin_assign_role_and_tenant(',start);assert.ok(start>0&&end>start);await m.query(old.slice(start,end));
 for(const file of ['20260909001600_task_membership_guard.sql','20260909001700_contract_renewal_task.sql'])await m.query(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await m.query('UPDATE profiles SET is_platform_admin=true WHERE id=$1',[id(10)]);
 async function asUser(c,user=10,tenant=1){await c.query('RESET ROLE');await c.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[id(user),id(tenant)]);await c.query('SET ROLE authenticated');}
 await asUser(a);await asUser(b);
 async function contract(n,company=20,tenant=1){await m.query('INSERT INTO contracts(id,tenant_id,company_id,name,renewal_responsible_set,renewal_task_created) VALUES($1,$2,$3,$4,true,true)',[id(n),id(tenant),id(company),'Native renewal '+n]);}
 const command=(n,extra={})=>({contract:n,command:randomUUID(),revision:0,assignee:11,date:'2026-10-01',basis:'Verified operational follow-up',...extra});
 const create=async(c,p)=>(await c.query('SELECT create_contract_renewal_task($1,$2,$3,$4,$5,$6,$7,$8) r',[id(10),id(1),id(p.contract),p.command,p.revision,id(p.assignee),p.date,p.basis])).rows[0].r;
 const snapshot=async(n,c=a)=>(await c.query('SELECT contract_renewal_snapshot($1,$2,$3) r',[id(10),id(1),id(n)])).rows[0].r;
 const rejects=(fn,msg)=>assert.rejects(fn,new RegExp(msg));
 await contract(100);assert.equal((await snapshot(100)).task,null);pass('legacy true flags do not fabricate a renewal task');
 const first=command(100);const result=await create(a,first);assert.equal((await snapshot(100)).task.id,result.taskId);assert.equal((await snapshot(100)).task.assigneeId,id(11));
 assert.equal((await m.query('SELECT count(*)::int n FROM task_assignment_history WHERE task_id=$1',[result.taskId])).rows[0].n,1);pass('atomic creation links real task, owner, date, basis and assignment history');
 assert.deepEqual(await create(a,first),result);await rejects(()=>create(a,{...first,basis:'different'}),'RENEWAL_EXISTS');pass('same command replays; changed payload never overwrites');
 await rejects(()=>a.query('SELECT admin_assign_role_and_tenant($1,$2,$3)',[id(11),'operasyon',id(2)]),'ACTIVE_TASKS_REQUIRE_TRANSFER');pass('renewal task participates in existing active-work offboarding guard');
 await a.query('SELECT transfer_tasks_scoped($1,$2,$3,$4,$5,$6::jsonb)',[id(10),id(1),randomUUID(),id(11),id(12),JSON.stringify([{id:result.taskId,revision:0}])]);assert.equal((await snapshot(100)).task.assigneeId,id(12));assert.deepEqual(await create(a,first),result);pass('transfer changes displayed owner while creation receipt remains replayable');
 await a.query("UPDATE tasks SET status='tamamlandi' WHERE id=$1",[result.taskId]);assert.equal((await m.query('SELECT status FROM contracts WHERE id=$1',[id(100)])).rows[0].status,'taslak');await rejects(()=>create(a,command(100)),'RENEWAL_EXISTS');pass('closing task does not renew contract or silently start another cycle');
 await rejects(()=>a.query('UPDATE tasks SET contract_id=NULL WHERE id=$1',[result.taskId]),'RENEWAL_CONTEXT_IMMUTABLE');
 await rejects(()=>m.query('DELETE FROM tasks WHERE id=$1',[result.taskId]),'foreign key');await rejects(()=>a.query('DELETE FROM contracts WHERE id=$1',[id(100)]),'RENEWAL_CONTEXT_IMMUTABLE|foreign key');await rejects(()=>a.query('UPDATE contracts SET company_id=$1 WHERE id=$2',[id(22),id(100)]),'RENEWAL_CONTEXT_IMMUTABLE');pass('linked contexts and destructive recreation cannot detach renewal history');
 await contract(101);await a.query("UPDATE contracts SET name='Changed',revision=0 WHERE id=$1",[id(101)]);assert.equal((await snapshot(101)).revision,1);await rejects(()=>create(a,command(101)),'RENEWAL_CONFLICT');pass('every contract update advances unspoofable revision and rejects stale preview');
 await contract(102,22);await rejects(()=>create(a,command(102)),'RENEWAL_PASSIVE');await contract(103,21,2);await rejects(()=>create(a,command(103)),'RENEWAL_SCOPE');assert.equal(await snapshot(103),null);pass('passive creation and foreign-tenant read/write rejected');
 await contract(104);await rejects(()=>create(a,command(104,{assignee:13})),'RENEWAL_TARGET');await rejects(()=>create(a,command(104,{basis:'\u00a0\ufeff'})),'RENEWAL_VALIDATION');await rejects(()=>create(a,command(104,{date:'infinity'})),'RENEWAL_VALIDATION');pass('foreign assignee, blank Unicode basis and infinite date rejected');
 await asUser(b,11);await rejects(()=>create(b,command(104)),'RENEWAL_SCOPE');await rejects(()=>b.query('SELECT create_contract_renewal_task($1,$2,$3,$4,0,$1,$5,$6)',[id(11),id(1),id(104),randomUUID(),'2026-10-01','basis']),'RENEWAL_FORBIDDEN');await asUser(b);pass('spoofed actor and non-manager creation rejected');
 await rejects(()=>a.query('SELECT * FROM contract_renewal_tasks'),'permission denied');pass('private relation and receipt cannot be read or written directly');
 await contract(105);const reused=command(105,{command:first.command});await rejects(()=>create(a,reused),'unique constraint');assert.equal((await m.query('SELECT count(*)::int n FROM tasks WHERE contract_id=$1',[id(105)])).rows[0].n,0);pass('late receipt constraint failure rolls back task and its history');
 const pidA=(await a.query('SELECT pg_backend_pid() pid')).rows[0].pid,pidB=(await b.query('SELECT pg_backend_pid() pid')).rows[0].pid;
 async function race(firstFn,secondFn,verify,label){await a.query('BEGIN');let pending;try{await firstFn();pending=secondFn().then(value=>({value}),error=>({error}));let blocked=false;for(let i=0;i<300;i++){if((await m.query('SELECT pg_blocking_pids($1) pids',[pidB])).rows[0].pids.includes(pidA)){blocked=true;break;}await delay(10);}assert.ok(blocked,'real lock wait required');await a.query('COMMIT');verify(await pending);pass(label);}catch(e){await a.query('ROLLBACK');if(pending)await pending;throw e;}}
 await contract(106);const concurrent=command(106);let winner;
 await race(async()=>{winner=await create(a,concurrent);},()=>create(b,concurrent),r=>assert.deepEqual(r.value,winner),'same-command concurrent requests converge to one task');
 await contract(107);await race(()=>create(a,command(107)),()=>create(b,command(107)),r=>assert.match(r.error?.message??'',/RENEWAL_EXISTS/),'different commands racing same contract produce one task');
 await contract(108);await race(()=>a.query("UPDATE contracts SET name='Concurrent edit' WHERE id=$1",[id(108)]),()=>create(b,command(108)),r=>assert.match(r.error?.message??'',/RENEWAL_CONFLICT/),'waiting create sees committed contract edit under READ COMMITTED');
 await a.query("UPDATE tasks SET status='tamamlandi' WHERE assigned_to_user_id=$1",[id(11)]);
 await contract(109);await race(()=>a.query('SELECT admin_assign_role_and_tenant($1,$2,$3)',[id(11),'operasyon',id(2)]),()=>create(b,command(109)),r=>assert.match(r.error?.message??'',/RENEWAL_TARGET/),'waiting create rechecks assignee membership after admin move');
 await a.query('BEGIN ISOLATION LEVEL REPEATABLE READ');await rejects(()=>create(a,command(109)),'RENEWAL_ISOLATION');await a.query('ROLLBACK');pass('stale higher-isolation snapshot fails closed');
 console.log(`Contract renewal checks: ${count} passed.`);
}finally{for(const c of clients)await c.end().catch(()=>{});await pg.stop().catch(()=>{});await rm(dir,{recursive:true,force:true});}
