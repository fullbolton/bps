import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';const pg=createRequire(import.meta.url)('pg');
const container='supabase_db_bps-supabase-acceptance',database=`bps_account_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const admin=sql=>execFileSync('docker',['exec','-i',container,'psql','-XqAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});
test('own profile write against complete local schema',async t=>{
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`);let c;
 try{
 const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();c=new pg.Client({host:'127.0.0.1',port:54322,user:'postgres',password,database});await c.connect();
 for(const f of loadFixtureMigrations())await c.query(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const original=(await c.query('SELECT display_name FROM profiles WHERE id=$1',[id(11)])).rows[0].display_name;
 await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1),role:'authenticated'})]);await c.query('SET ROLE authenticated');
 await t.test('own name writes and stale expected name cannot overwrite',async()=>{assert.equal((await c.query('UPDATE profiles SET display_name=$1 WHERE id=$2 AND display_name=$3 RETURNING id,display_name',['Sentetik Yeni',id(11),original])).rowCount,1);assert.equal((await c.query('UPDATE profiles SET display_name=$1 WHERE id=$2 AND display_name=$3 RETURNING id',['Eski form',id(11),original])).rowCount,0);});
 await t.test('other profile cannot be edited',async()=>{assert.equal((await c.query('UPDATE profiles SET display_name=$1 WHERE id=$2 RETURNING id',['Forbidden',id(12)])).rowCount,0);});
 await t.test('role and platform privilege columns cannot be edited',async()=>{for(const field of ['role','is_platform_admin'])await assert.rejects(c.query(`UPDATE profiles SET ${field}=${field} WHERE id=$1`,[id(11)]),e=>e.code==='42501');});
 await t.test('anonymous writes denied',async()=>{await c.query('RESET ROLE');await c.query('SET ROLE anon');await assert.rejects(c.query('UPDATE profiles SET display_name=$1 WHERE id=$2',['Forbidden',id(11)]),e=>e.code==='42501');});
 }finally{if(c)await c.end();admin(`DROP DATABASE ${database} WITH (FORCE);`);}
});
