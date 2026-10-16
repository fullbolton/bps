// Disposable local database. Tests session identity, not caller-editable JWT roles.
import {createRequire} from 'node:module';
const {Client}=createRequire(import.meta.url)('pg');
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const container='supabase_db_bps-supabase-acceptance',database=`bps_barrier_${process.pid}`;
const password=execFileSync('docker',['exec',container,'printenv','POSTGRES_PASSWORD'],{encoding:'utf8'}).trim();
const admin=q=>execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8'});
const clients=[],checks=[];let created=false;
try {
 admin(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005`);created=true;
 for(let i=0;i<3;i++){const c=new Client({host:'127.0.0.1',port:54322,user:'supabase_admin',password,database,statement_timeout:12000});await c.connect();clients.push(c);}
 const [a,b,c]=clients;
 await a.query('CREATE TABLE public.release_foreign_probe(id integer);ALTER TABLE public.release_foreign_probe OWNER TO supabase_storage_admin;SET ROLE postgres');
 await assert.rejects(a.query(readFileSync(new URL('./install.sql',import.meta.url),'utf8')),e=>e.message==='RELEASE_GUARD_OWNER_PRIVILEGES_REQUIRED');
 await a.query('ROLLBACK;RESET ROLE;DROP TABLE public.release_foreign_probe');
 assert.equal((await a.query("SELECT to_regnamespace('bps_release_guard') AS n")).rows[0].n,null);
 checks.push('non-owner installer fails before any barrier is created');

 await a.query(`GRANT USAGE ON SCHEMA public TO authenticated,service_role,supabase_storage_admin;CREATE TABLE public.release_probe(id integer);GRANT ALL ON public.release_probe TO authenticated,service_role,supabase_storage_admin;
 CREATE FUNCTION public.release_probe_rpc() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS 'INSERT INTO public.release_probe VALUES(2)';
 ALTER FUNCTION public.release_probe_rpc() OWNER TO postgres;GRANT EXECUTE ON FUNCTION public.release_probe_rpc() TO authenticated,service_role;`);
 await a.query('ALTER TABLE public.release_probe OWNER TO postgres');
 await a.query('BEGIN;INSERT INTO public.release_probe VALUES(1)');
 await b.query('SET ROLE postgres');
 const installing=b.query(readFileSync(new URL('./install.sql',import.meta.url),'utf8')).then(()=>null,e=>e);
 let blocked=false;
 for(let i=0;i<100;i++){
  const r=await c.query('SELECT cardinality(pg_blocking_pids($1)) AS n',[b.processID]);
  if(r.rows[0].n>0){blocked=true;break;}await new Promise(r=>setTimeout(r,20));
 }
 assert.ok(blocked,'Installer must wait for the existing writer');
 await c.query('SELECT count(*) FROM public.release_probe');checks.push('install waits for existing writer while reader proceeds');
 await a.query('COMMIT');assert.equal(await installing,null);checks.push('barrier installs after writer commits');
 for(const [login,role] of [['authenticator','authenticated'],['authenticator','service_role'],['supabase_storage_admin',null]]){
  await a.query(`SET SESSION AUTHORIZATION ${login};${role?`SET ROLE ${role};`:''}`);
  for(const q of ['INSERT INTO public.release_probe VALUES(9)','UPDATE public.release_probe SET id=9','DELETE FROM public.release_probe','TRUNCATE public.release_probe'])await assert.rejects(a.query(q),e=>e.code==='PT503');
  await a.query('SELECT * FROM public.release_probe');
  if(role)await assert.rejects(a.query('SELECT public.release_probe_rpc()'),e=>e.code==='PT503');
  await a.query('RESET SESSION AUTHORIZATION');checks.push(`${login}/${role||'login'} writes blocked; reads allowed`);
 }
 await a.query('INSERT INTO public.release_probe VALUES(3)');checks.push('direct admin migration DML remains available');
 assert.deepEqual((await a.query('SELECT id FROM public.release_probe ORDER BY id')).rows.map(r=>r.id),[1,3]);
 const inventory=await a.query(`SELECT count(*)::integer AS n FROM bps_release_guard.targets`);assert.ok(inventory.rows[0].n>50);
 const verify=readFileSync(new URL('./verify.sql',import.meta.url),'utf8');
 await b.query(verify);
 await a.query('CREATE TABLE public.release_new_table(id integer);ALTER TABLE public.release_new_table OWNER TO postgres');
 await assert.rejects(b.query(verify),e=>e.message==='RELEASE_GUARD_COVERAGE_INCOMPLETE');
 await b.query('ROLLBACK');
 await b.query(readFileSync(new URL('./extend.sql',import.meta.url),'utf8'));
 await b.query(readFileSync(new URL('./extend.sql',import.meta.url),'utf8'));
 await b.query(verify);checks.push('new migration tables fail coverage then extend restores coverage idempotently');
 await a.query('ALTER TABLE public.release_probe DISABLE TRIGGER bps_release_write_guard');
 await assert.rejects(b.query(readFileSync(new URL('./remove.sql',import.meta.url),'utf8')),e=>e.message.startsWith('RELEASE_GUARD_DRIFT'));
 await b.query('ROLLBACK');
 await a.query('ALTER TABLE public.release_probe ENABLE TRIGGER bps_release_write_guard');
 await b.query(verify);checks.push('removal drift fails atomically and preserves guard');
 await b.query(readFileSync(new URL('./remove.sql',import.meta.url),'utf8'));
 await a.query('SET SESSION AUTHORIZATION authenticator;SET ROLE authenticated;INSERT INTO public.release_probe VALUES(4);RESET SESSION AUTHORIZATION');checks.push('explicit removal restores API write');
 assert.equal((await a.query("SELECT to_regnamespace('bps_release_guard') AS n")).rows[0].n,null);
 writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify({scope:'local synthetic PostgreSQL; not Storage HTTP acceptance',checks,coveredTables:inventory.rows[0].n,productionApplied:false},null,2)+'\n');
 console.log(checks.length+' checks passed; '+inventory.rows[0].n+' tables guarded');
} finally {
 await Promise.allSettled(clients.map(c=>c.end()));
 if(created)admin(`DROP DATABASE ${database} WITH (FORCE)`);
}
