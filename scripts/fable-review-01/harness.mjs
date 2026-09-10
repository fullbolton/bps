// Fable review 01 — isolated embedded PostgreSQL harness for İşe Başlama Takibi acceptance.
// Own temp dir + own port (default 55471; override BPS_FABLE_PG_PORT). Never touches local Supabase,
// production or the shared QA lock. Applies the REAL migration bodies (13 ops files 000100–001200 + 002700;
// optionally 001600 with a fixture-only tasks/admin stub). Shared fixture is read, never modified.
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {randomUUID} from 'node:crypto';
import {baseline,id} from '../fixtures/daily-operations.mjs';
export {id};
export const MIGRATIONS=['000100_daily_operations_pilot','000200_location_import','000300_scoped_operation_command','000400_command_reconciliation','000500_weekly_operations','000600_request_batch','000700_resize_request','000800_attendance','000900_replace_assignment','001000_attendance_week','001100_operations_directory','001200_directory_activation','002700_start_tracking'];
// Fixture-only stub so the real 001600 guard triggers can be installed; NOT the production admin RPC.
const GUARD_STUB=`CREATE TABLE public.tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid,assigned_to_user_id uuid,status text NOT NULL DEFAULT 'acik');
CREATE FUNCTION public.is_platform_admin() RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';
CREATE FUNCTION public.admin_assign_role_and_tenant(p_user_id uuid,p_role text,p_tenant_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RAISE EXCEPTION 'fixture stub'; END $$;`;
const migrationsDir=new URL('../../supabase/migrations/',import.meta.url);
export async function startDb({guard=false,extraMigrations=[]}={}){
 const mod=process.env.BPS_EMBEDDED_PG_MODULE;if(!mod)throw Error('BPS_EMBEDDED_PG_MODULE tanımlı değil (native runtime yolu gerekli)');
 const port=Number(process.env.BPS_FABLE_PG_PORT??55471);
 const {default:EmbeddedPostgres}=await import(pathToFileURL(mod).href);
 const dir=await mkdtemp(join(tmpdir(),'bps-fable01-'));
 const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),user:'postgres',password:randomUUID(),port,persistent:false,postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:()=>{}});
 await pg.initialise();await pg.start();
 const root=pg.getPgClient('postgres','127.0.0.1');await root.connect();
 await root.query(baseline);await root.query("ALTER TABLE profiles ADD display_name text NOT NULL DEFAULT 'Synthetic operator'");
 for(const m of MIGRATIONS)await root.query(await readFile(new URL('20260909'+m+'.sql',migrationsDir),'utf8'));
 if(guard){await root.query(GUARD_STUB);await root.query(await readFile(new URL('20260909001600_task_membership_guard.sql',migrationsDir),'utf8'));}
 for(const m of extraMigrations)await root.query(await readFile(new URL(m,migrationsDir),'utf8'));
 const clients=[root];
 const connect=async()=>{const c=pg.getPgClient('postgres','127.0.0.1');await c.connect();clients.push(c);return c;};
 const stop=async()=>{for(const c of clients)await c.end().catch(()=>{});await pg.stop();await rm(dir,{recursive:true,force:true});};
 return {root,connect,stop,port};
}
export async function as(client,user,tenant=1){await client.query('RESET ROLE');await client.query("SELECT set_config('test.user',$1,false),set_config('test.tenant',$2,false)",[user===null?'':id(user),id(tenant)]);await client.query('SET ROLE authenticated');}
export const exec=async(client,{user=10,tenant=1,command=randomUUID(),assignment,rev,action,payload={}})=>(await client.query('SELECT public.ops_start_execute($1,$2,$3,$4,$5,$6,$7) r',[id(user),id(tenant),command,assignment,rev,action,payload])).rows[0].r;
export const board=async(client,{user=10,tenant=1,day})=>(await client.query('SELECT public.ops_start_board($1,$2,$3) r',[id(user),id(tenant),day])).rows[0].r;
export const rowOf=(b,assignment)=>b.rows.find(r=>r.id===assignment);
export const istanbulToday=async(client)=>(await client.query("SELECT (clock_timestamp() AT TIME ZONE 'Europe/Istanbul')::date::text d")).rows[0].d;
export const shiftDay=(day,n)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
// Seed: location 100 (company 20, tenant 1); workers 200..203; request per work date; assignments as given.
export async function seed(root,{requests}){
 await root.query('RESET ROLE');
 await root.query(`INSERT INTO ops_locations(id,tenant_id,company_id,name,city) VALUES($1,$2,$3,'Synthetic branch','Istanbul') ON CONFLICT DO NOTHING`,[id(100),id(1),id(20)]);
 for(const [n,code] of [[200,'A'],[201,'B'],[202,'C'],[203,'D'],[204,'E'],[205,'F'],[206,'G'],[207,'H'],[208,'I']])await root.query(`INSERT INTO ops_workers(id,tenant_id,name,code,kind) VALUES($1,$2,$3,$4,'idp') ON CONFLICT DO NOTHING`,[id(n),id(1),'Worker '+code,code]);
 for(const r of requests){
  await root.query(`INSERT INTO ops_daily_requests(id,tenant_id,company_id,location_id,work_date,service_line,position,required_count,created_by) VALUES($1,$2,$3,$4,$5,'temizlik','temizlik',$6,$7)`,[id(r.id),id(1),id(20),id(100),r.workDate,r.required??5,id(10)]);
  for(const a of r.assignments??[])await root.query(`INSERT INTO ops_assignments(id,tenant_id,request_id,work_date,worker_id,created_by) VALUES($1,$2,$3,$4,$5,$6)`,[id(a.id),id(1),id(r.id),r.workDate,id(a.worker),id(10)]);
 }
}
export async function rejects(fn,re){let error;try{await fn();}catch(e){error=e;}
 if(!error)throw Error('beklenen hata '+re+' gelmedi (işlem başarılı oldu)');
 if(!re.test(error.message))throw Error('beklenen '+re+' ama gelen: '+error.message);return error;}
export const pid=async(c)=>(await c.query('SELECT pg_backend_pid() p')).rows[0].p;
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// 'pending' if the promise has not settled yet (0 ms race), else 'settled'.
export const state=p=>Promise.race([p.then(()=>'settled',()=>'settled'),new Promise(r=>setTimeout(()=>r('pending'),0))]);
export const blockers=async(root,waiterPid)=>(await root.query('SELECT pg_blocking_pids($1) b',[waiterPid])).rows[0].b;
// Proof of blocking: after `ms`, promise still pending AND the waiter's backend is blocked by `holderPid`.
export async function assertBlocked(root,promise,waiterPid,holderPid,ms=400){promise.catch(()=>{});await sleep(ms);
 const s=await state(promise);const b=await blockers(root,waiterPid);
 if(s!=='pending'||!b.includes(holderPid))throw Error(`bloklanma kanıtı yok: promise=${s}, pg_blocking_pids=${JSON.stringify(b)} (beklenen ${holderPid})`);
 return b;}
export const count=async(root,sql,params=[])=>Number((await root.query(sql,params)).rows[0].n);
export const plan=(responsible=10,time='00:01',offsets=[-1])=>({time,responsibleId:id(responsible),offsets});
export const ist=(day,hms)=>new Date(`${day}T${hms}+03:00`).toISOString();
