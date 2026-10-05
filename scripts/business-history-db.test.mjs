import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname));
const name=`bps_business_history_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false;
const migration=sqlFile('20261005002000_preserve_business_history.sql');
const body=migration.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const keys=[['contracts','contracts_company_tenant_fkey','CASCADE'],['appointments','appointments_company_tenant_fkey','CASCADE'],['appointments','appointments_contract_company_tenant_fkey','SET NULL (contract_id)'],['documents','documents_company_id_fkey','CASCADE'],['documents','documents_contract_id_fkey','SET NULL'],['appointment_completion_receipts','appointment_completion_receipts_appointment_id_fkey','CASCADE']];
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');}}
async function original(){for(const [table,key,action] of keys){const def=(await db.query('SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conrelid=$1::regclass AND conname=$2',[table,key])).rows[0].d.replace('ON DELETE RESTRICT','ON DELETE '+action);await db.query(`ALTER TABLE ${table} DROP CONSTRAINT ${key}, ADD CONSTRAINT ${key} ${def}`);}}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;db=new Client({connectionString:url.href});await db.connect();
 // Small parent tables; current FK definitions below are extracted from the actual migrations.
 await db.query(`CREATE TABLE companies(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,status text,UNIQUE(tenant_id,id));
 CREATE TABLE contracts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,status text,UNIQUE(id,company_id,tenant_id));
 CREATE TABLE appointments(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL,contract_id uuid,status text);
 CREATE TABLE documents(id uuid PRIMARY KEY,company_id uuid NOT NULL,contract_id uuid,name text);
 `);
 const company=sqlFile('20260928000600_company_tenant_foreign_keys.sql');
 for(const table of ['contracts','appointments']){const start=company.indexOf(`ADD CONSTRAINT ${table}_company_tenant_fkey`);assert.ok(start>=0);const end=company.indexOf('ON DELETE CASCADE',start)+'ON DELETE CASCADE'.length;await db.query(`ALTER TABLE ${table} ${company.slice(start,end)}`);}

 const relation=sqlFile('20260915000600_related_company_boundaries.sql');const start=relation.indexOf('ADD CONSTRAINT appointments_contract_company_tenant_fkey');await db.query('ALTER TABLE appointments '+relation.slice(start,relation.indexOf(';',start)+1));
 const receipt=sqlFile('20260909001400_appointment_completion.sql');await db.query(receipt.slice(receipt.indexOf('CREATE TABLE'),receipt.indexOf('ALTER TABLE')));
 const docBase=sqlFile('20260407001000_create_documents.sql');assert.match(docBase,/company_id\s+uuid NOT NULL REFERENCES companies\(id\) ON DELETE CASCADE/);
 const docLink=sqlFile('20260425000200_documents_contract_link.sql');assert.match(docLink,/REFERENCES contracts\(id\) ON DELETE SET NULL/);
 await db.query(`ALTER TABLE documents ADD CONSTRAINT documents_company_id_fkey FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE, ADD CONSTRAINT documents_contract_id_fkey FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE SET NULL;
 INSERT INTO companies VALUES('${id(101)}','${id(1)}','aktif'),('${id(102)}','${id(1)}','aktif');
 INSERT INTO contracts VALUES('${id(201)}','${id(1)}','${id(101)}','aktif');
 INSERT INTO appointments VALUES('${id(301)}','${id(1)}','${id(101)}','${id(201)}','tamamlandi');
 INSERT INTO documents VALUES('${id(401)}','${id(101)}','${id(201)}','Synthetic contract PDF');
 INSERT INTO appointment_completion_receipts(appointment_id,tenant_id,actor_id,result_text,next_action,create_task) VALUES('${id(301)}','${id(1)}','${id(11)}','Done','None',false);`);
 await db.query(migration);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('six validated immediate RESTRICT keys retain their original column order',async()=>{
 const rows=(await db.query('SELECT conname,confdeltype,convalidated,condeferrable FROM pg_constraint WHERE conname=ANY($1)',[keys.map(k=>k[1])])).rows;assert.equal(rows.length,6);assert.ok(rows.every(r=>r.confdeltype==='r'&&r.convalidated&&!r.condeferrable));
 const attrs=(await db.query("SELECT array_agg(a.attname::text ORDER BY k.ord) names FROM pg_constraint c CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num WHERE c.conname='appointments_contract_company_tenant_fkey'")).rows[0].names;assert.deepEqual(attrs,['contract_id','company_id','tenant_id']);
});
test('company cannot cascade its contract, appointment or document history',async()=>{
 await rollback(async()=>{await assert.rejects(db.query('DELETE FROM companies WHERE id=$1',[id(101)]),e=>e.code==='23503');});
 for(const table of ['contracts','appointments','documents'])assert.equal((await db.query('SELECT count(*)::int n FROM '+table)).rows[0].n,1);
});
test('contract deletion cannot detach an appointment or reclassify its PDF as a general document',async()=>{
 for(const target of ['appointments','documents'])await rollback(async()=>{if(target==='appointments')await db.query('DELETE FROM documents');else await db.query('DELETE FROM appointment_completion_receipts; DELETE FROM appointments');await assert.rejects(db.query('DELETE FROM contracts WHERE id=$1',[id(201)]),e=>e.code==='23503'&&e.constraint===(target==='appointments'?'appointments_contract_company_tenant_fkey':'documents_contract_id_fkey'));});
 assert.equal((await db.query('SELECT contract_id FROM documents')).rows[0].contract_id,id(201));
});
test('completed appointment cannot lose its idempotency receipt through parent deletion',async()=>{
 await rollback(async()=>{await assert.rejects(db.query('DELETE FROM appointments WHERE id=$1',[id(301)]),e=>e.code==='23503'&&e.constraint==='appointment_completion_receipts_appointment_id_fkey');});
 assert.equal((await db.query('SELECT result_text FROM appointment_completion_receipts')).rows[0].result_text,'Done');
});
test('status changes and nullable contract-free appointments remain usable',async()=>{
 await rollback(async()=>{await db.query("UPDATE companies SET status='pasif';UPDATE contracts SET status='feshedildi';UPDATE appointments SET status='iptal'");await db.query('INSERT INTO appointments VALUES($1,$2,$3,NULL,$4)',[id(302),id(1),id(101),'planlandi']);assert.equal((await db.query('SELECT count(*)::int n FROM appointments')).rows[0].n,2);});
});
test('deleting a parent with no dependent history is still allowed',async()=>{
 await rollback(async()=>{assert.equal((await db.query('DELETE FROM companies WHERE id=$1',[id(102)])).rowCount,1);});
});
test('SET NULL scope drift is rejected before changing that relation',async()=>{
 await rollback(async()=>{await original();await db.query('ALTER TABLE appointments DROP CONSTRAINT appointments_contract_company_tenant_fkey, ADD CONSTRAINT appointments_contract_company_tenant_fkey FOREIGN KEY(contract_id,company_id,tenant_id) REFERENCES contracts(id,company_id,tenant_id) ON DELETE SET NULL');await db.query('SAVEPOINT migration');await assert.rejects(db.query(body),/BUSINESS_HISTORY_RELATION_DRIFT/);await db.query('ROLLBACK TO migration');assert.equal((await db.query("SELECT confdeltype FROM pg_constraint WHERE conname='contracts_company_tenant_fkey'")).rows[0].confdeltype,'c');});
});
test('an extra cascading FK aborts and rolls back the whole migration',async()=>{
 await rollback(async()=>{await original();await db.query('ALTER TABLE documents ADD CONSTRAINT unexpected_document_parent FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE');await db.query('SAVEPOINT migration');await assert.rejects(db.query(body),/BUSINESS_HISTORY_RELATION_UNEXPECTED/);await db.query('ROLLBACK TO migration');assert.equal((await db.query("SELECT confdeltype FROM pg_constraint WHERE conname='contracts_company_tenant_fkey'")).rows[0].confdeltype,'c');});
});
