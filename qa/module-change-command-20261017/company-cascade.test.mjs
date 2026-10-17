import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {loadFixtureMigrations} from './fixture-migrations.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_cascade_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('company deletion is inaccessible and status changes preserve child records',async t=>{
 let c;admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);
 try{
  const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
  c=new Client({host:'127.0.0.1',port:54322,user:'postgres',password,database,statement_timeout:8000});await c.connect();
  for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
  await t.test('anonymous, authenticated and service roles cannot delete or truncate companies',async()=>{
   const rows=(await c.query("select r,has_table_privilege(r,'public.companies','DELETE') d,has_table_privilege(r,'public.companies','TRUNCATE') t from unnest(array['anon','authenticated','service_role']) r")).rows;
   assert.equal(rows.length,3);assert.ok(rows.every(r=>!r.d&&!r.t));
  });
  for(const [i,table,module] of [[1,'staffing_demands','staffing'],[2,'workforce_summary','staffing'],[3,'financial_summaries','finance']]){
   await t.test(`${table}: closed/open deletion denied and deactivation preserves rows`,async()=>{
    await c.query('RESET ROLE');
    const company=id(9700+i);
    await c.query("insert into companies(id,tenant_id,name) values($1,$2,'Synthetic cascade')",[company,id(1)]);
    await c.query(`insert into ${table}(tenant_id,company_id${table==='staffing_demands'?',position':''}) values($1,$2${table==='staffing_demands'?",'Synthetic'":''})`,[id(1),company]);
    assert.equal((await c.query('update tenant_module_settings set enabled=false where tenant_id=$1 and module_key=$2 returning module_key',[id(1),module])).rowCount,1);
    await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);
    await c.query('SET ROLE authenticated');
    await assert.rejects(c.query('delete from companies where id=$1 returning id',[company]),{code:'42501'});
    await c.query("select company_execute_v1('status',$1,$2,$3,'{\"status\":\"pasif\"}')",[company,id(1),id(11)]);
    await c.query('RESET ROLE');
    assert.equal((await c.query('select id from companies where id=$1',[company])).rowCount,1);
    assert.equal((await c.query(`select company_id from ${table} where company_id=$1`,[company])).rowCount,1);
    await c.query('update tenant_module_settings set enabled=true where tenant_id=$1 and module_key=$2',[id(1),module]);
    await c.query('SET ROLE authenticated');
    await assert.rejects(c.query('delete from companies where id=$1 returning id',[company]),{code:'42501'});
    await assert.rejects(c.query("select company_execute_v1('delete',$1,$2,$3,'{}')",[company,id(1),id(11)]),{code:'BC400'});
    await c.query("select company_execute_v1('status',$1,$2,$3,'{\"status\":\"pasif\"}')",[company,id(1),id(11)]);
    await c.query('RESET ROLE');
    assert.equal((await c.query(`select company_id from ${table} where company_id=$1`,[company])).rowCount,1);
    assert.equal((await c.query('select status from companies where id=$1',[company])).rows[0].status,'pasif');
   });
  }
 }finally{if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
