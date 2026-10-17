import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_legacy_staffing_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('legacy staffing module fences on a disposable schema clone',async t=>{
 const clients=[];admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);
 try{
  const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
  for(let i=0;i<2;i++){const c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database,statement_timeout:8000});await c.connect();clients.push(c);}
  const [a,b]=clients;
  await a.query("insert into companies(id,tenant_id,name) values($1,$2,'Synthetic legacy gate')",[id(900),id(1)]);
  await b.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);
  await b.query('SET ROLE authenticated');
  await a.query("update tenant_module_settings set enabled=false where tenant_id=$1 and module_key='staffing'",[id(1)]);
  await t.test('reproduces the existing closed-module direct write gap',async()=>{
   await b.query("insert into staffing_demands(id,tenant_id,company_id,position) values($1,$2,$3,'Synthetic')",[id(901),id(1),id(900)]);
   await b.query('insert into workforce_summary(id,tenant_id,company_id) values($1,$2,$3)',[id(902),id(1),id(900)]);
   assert.equal((await b.query('select id from staffing_demands where id=$1',[id(901)])).rowCount,1);
  });
  await t.test('schema drift aborts migration without leaving helper or policy behind',async()=>{
   await a.query('alter table workforce_summary disable row level security');
   await assert.rejects(a.query(readFileSync(new URL('../../supabase/migrations/20261017000100_legacy_staffing_module_barriers.sql',import.meta.url),'utf8')), /LEGACY_STAFFING_MODULE_SCHEMA/);
   await a.query('ROLLBACK');
   assert.equal((await a.query("select to_regprocedure('public.legacy_staffing_write_barrier_v1()') value")).rows[0].value,null);
   assert.equal((await a.query("select count(*)::int n from pg_policy where polname='staffing_demands_module_fence'")).rows[0].n,0);
   await a.query('alter table workforce_summary enable row level security');
  });
  await a.query(readFileSync(new URL('../../supabase/migrations/20261017000100_legacy_staffing_module_barriers.sql',import.meta.url),'utf8'));
  for(const table of ['staffing_demands','workforce_summary'])await t.test(`${table}: closed reads hidden and insert/update/delete rejected`,async()=>{
   assert.equal((await b.query(`select id from ${table}`)).rowCount,0);
   for(const sql of [`update ${table} set location='no'`,`delete from ${table}`,table==='staffing_demands'?`insert into ${table}(tenant_id,company_id,position) values('${id(1)}','${id(900)}','no')`:`insert into ${table}(tenant_id,company_id) values('${id(1)}','${id(900)}')`])await assert.rejects(b.query(sql),{code:'BM001'});
  });
  await t.test('open state preserves legitimate writes and tenant RLS',async()=>{
   await a.query("update tenant_module_settings set enabled=true where tenant_id=$1 and module_key='staffing'",[id(1)]);
   for(const table of ['staffing_demands','workforce_summary']){
    assert.equal((await b.query(`update ${table} set location='Synthetic updated' where company_id=$1 returning id`,[id(900)])).rowCount,1);
    await assert.rejects(b.query(`update ${table} set tenant_id=$1 where company_id=$2`,[id(2),id(900)]),{code:'42501'});
   }
  });
  await t.test('waiting direct writer reads the closed state after config commit',async()=>{
   await a.query('BEGIN');await a.query('select 1 from tenant_module_config where tenant_id=$1 for update',[id(1)]);
   const waiting=b.query("update workforce_summary set location='must not commit' where id=$1",[id(902)]).then(()=>null,e=>e.code);
   let found=false;for(let i=0;i<100;i++){if((await a.query('select wait_event_type from pg_stat_activity where pid=$1',[b.processID])).rows[0]?.wait_event_type==='Lock'){found=true;break;}await new Promise(r=>setTimeout(r,20));}assert.ok(found);
   await a.query("update tenant_module_settings set enabled=false where tenant_id=$1 and module_key='staffing'",[id(1)]);await a.query('COMMIT');assert.equal(await waiting,'BM001');
   assert.equal((await a.query('select location from workforce_summary where id=$1',[id(902)])).rows[0].location,'Synthetic updated');
  });
 }finally{await Promise.all(clients.map(c=>c.end()));admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
