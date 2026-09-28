import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname));
const name=`bps_customer_history_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
const migration=sqlFile('20260928002700_preserve_customer_history.sql');
const body=migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');}}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;db=new Client({connectionString:url.href});await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,display_name text);INSERT INTO profiles VALUES('${id(11)}','yonetici','Synthetic author');
 CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid REFERENCES tenants(id),status text);INSERT INTO companies VALUES('${id(101)}','${id(1)}','aktif'),('${id(102)}','${id(1)}','aktif');
 `);
 const contacts=sqlFile('20260407000300_create_contacts.sql');await db.query(contacts.slice(0,contacts.indexOf('alter table public.contacts enable row level security;')));
 const notes=sqlFile('20260407000400_create_notes.sql');await db.query(notes.slice(0,notes.indexOf('-- RLS — notes')));
 await db.query(sqlFile('20260415000100_create_mizan_tables.sql'));
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 await db.query(`INSERT INTO contacts(id,company_id,full_name,email,created_by) VALUES('${id(201)}','${id(101)}','Synthetic','synthetic@example.test','${id(11)}');
 INSERT INTO notes(id,company_id,author_id,author_name,content) VALUES('${id(301)}','${id(101)}','${id(11)}','Synthetic author','Historical note');
 INSERT INTO mizan_uploads(id,file_name,uploaded_by) VALUES('${id(401)}','synthetic.xlsx','${id(11)}');
 INSERT INTO mizan_upload_rows(id,upload_id,account_code,account_name) VALUES('${id(501)}','${id(401)}','120','Synthetic account');`);
 await db.query(migration);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('all five exact foreign keys become validated immediate RESTRICT constraints',async()=>{
 const rows=(await db.query("SELECT conname,confdeltype,convalidated,condeferrable FROM pg_constraint WHERE conname=ANY($1) ORDER BY conname",[['contacts_company_id_fkey','contacts_created_by_fkey','notes_company_id_fkey','notes_author_id_fkey','mizan_upload_rows_upload_id_fkey']])).rows;
 assert.equal(rows.length,5);assert.ok(rows.every(r=>r.confdeltype==='r'&&r.convalidated&&!r.condeferrable));
});
test('company deletion cannot cascade contacts or notes, even with modules disabled',async()=>{
 for(const closed of [false,true])await rollback(async()=>{if(closed)await db.query('UPDATE tenant_module_settings SET enabled=false');await assert.rejects(db.query('DELETE FROM companies WHERE id=$1',[id(101)]),e=>e.code==='23503');});
 assert.equal((await db.query('SELECT count(*)::int n FROM contacts')).rows[0].n,1);assert.equal((await db.query('SELECT count(*)::int n FROM notes')).rows[0].n,1);
});
test('profile deletion cannot erase contact or note authorship',async()=>{
 // Remove unrelated mizan author FK from this attempted delete so contact/note guards are the evidence.
 for(const table of ['contacts','notes'])await rollback(async()=>{await db.query('UPDATE mizan_uploads SET uploaded_by=NULL');await db.query(table==='contacts'?'DELETE FROM notes':'DELETE FROM contacts');await assert.rejects(db.query('DELETE FROM profiles WHERE id=$1',[id(11)]),e=>e.code==='23503'&&e.constraint===(table==='contacts'?'contacts_created_by_fkey':'notes_author_id_fkey'));});
 assert.equal((await db.query('SELECT author_id FROM notes')).rows[0].author_id,id(11));
});
test('mizan upload deletion cannot silently remove confirmed row history',async()=>{
 await rollback(async()=>{await assert.rejects(db.query('DELETE FROM mizan_uploads WHERE id=$1',[id(401)]),e=>e.code==='23503'&&e.constraint==='mizan_upload_rows_upload_id_fkey');});
 assert.equal((await db.query('SELECT count(*)::int n FROM mizan_upload_rows')).rows[0].n,1);
});
test('deactivation and membership removal preserve historical records and continue working',async()=>{
 await rollback(async()=>{await db.query("UPDATE companies SET status='pasif' WHERE id=$1",[id(101)]);await db.query('DELETE FROM tenant_memberships WHERE user_id=$1',[id(11)]);assert.equal((await db.query('SELECT author_id FROM notes')).rows[0].author_id,id(11));assert.equal((await db.query('SELECT created_by FROM contacts')).rows[0].created_by,id(11));});
});
test('unreferenced parents can still be deleted; this is not a blanket delete trigger',async()=>{
 await rollback(async()=>{assert.equal((await db.query('DELETE FROM companies WHERE id=$1',[id(102)])).rowCount,1);});
});
test('schema drift fails and rolls back earlier constraint replacements',async()=>{
 // Reconstruct pre-migration actions from their real catalog definitions within an outer savepoint.
 await rollback(async()=>{
  for(const [table,key,action] of [['contacts','contacts_company_id_fkey','CASCADE'],['contacts','contacts_created_by_fkey','SET NULL'],['notes','notes_company_id_fkey','CASCADE'],['notes','notes_author_id_fkey','SET NULL'],['mizan_upload_rows','mizan_upload_rows_upload_id_fkey','CASCADE']]){
   const def=(await db.query('SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2',[table,key])).rows[0].d.replace('ON DELETE RESTRICT','ON DELETE '+action);
   await db.query(`ALTER TABLE ${table} DROP CONSTRAINT ${key}, ADD CONSTRAINT ${key} ${def}`);
  }
  await db.query('ALTER TABLE notes RENAME CONSTRAINT notes_author_id_fkey TO unexpected_author_key');await db.query('SAVEPOINT apply_migration');
  await assert.rejects(db.query(body),/CUSTOMER_HISTORY_RELATION_MISSING/);await db.query('ROLLBACK TO apply_migration');
  assert.equal((await db.query("SELECT confdeltype FROM pg_constraint WHERE conname='contacts_company_id_fkey'")).rows[0].confdeltype,'c');
 });
});
test('concurrent child insert prevents a waiting company delete after commit',async()=>{
 const writer=new Client({connectionString:url.href}),deleter=new Client({connectionString:url.href,query_timeout:5000});await writer.connect();await deleter.connect();let pending;
 try{
  await writer.query('BEGIN');await writer.query('INSERT INTO contacts(id,company_id,full_name,email) VALUES($1,$2,$3,$4)',[id(202),id(102),'Concurrent contact','synthetic@example.test']);
  const pid=(await deleter.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=deleter.query('DELETE FROM companies WHERE id=$1',[id(102)]).then(value=>({value}),error=>({error}));
  let blocked=false;for(let i=0;i<100;i++){await db.query('SELECT pg_stat_clear_snapshot()');if((await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(blocked,true);await writer.query('COMMIT');assert.equal((await pending).error.code,'23503');
  assert.equal((await db.query('SELECT id FROM contacts WHERE id=$1',[id(202)])).rowCount,1);
 }finally{await writer.query('ROLLBACK');if(pending)await pending;await db.query('DELETE FROM contacts WHERE id=$1',[id(202)]);await writer.end();await deleter.end();}
});
