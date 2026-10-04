import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { Client } = createRequire(import.meta.url)('pg');
const url = new URL(process.env.BPS_MODULE_TEST_DATABASE_URL ?? 'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
const name = `bps_expiry_${process.pid}_${Date.now()}`;
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let admin, db, created = false;
before(async () => {
  admin = new Client({ connectionString: url.href }); await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`); created = true;
  const target = new URL(url); target.pathname = '/' + name;
  db = new Client({ connectionString: target.href }); await db.connect();
  await db.query(`CREATE TABLE contracts(id uuid PRIMARY KEY, tenant_id uuid, end_date date);
    CREATE TABLE documents(id uuid PRIMARY KEY, tenant_id uuid, validity_date date);
    CREATE TABLE notification_log(kind text NOT NULL, entity_id uuid NOT NULL, recipient_profile_id uuid NOT NULL,
      threshold_key text NOT NULL, tenant_id uuid NOT NULL, sent_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(kind,entity_id,recipient_profile_id,threshold_key));
    INSERT INTO contracts VALUES('${id(1)}','${id(10)}','2026-10-15'),('${id(2)}','${id(10)}',NULL),('${id(3)}','${id(20)}','2026-10-15');
    INSERT INTO documents VALUES('${id(4)}','${id(10)}','2026-10-20');`);
  for (const [kind, entity] of [['contract_expiry',1],['contract_expiry',2],['contract_expiry',3],['contract_expiry',99],['document_expiry',4]]) {
    await db.query('INSERT INTO notification_log VALUES($1,$2,$3,$4,$5,$6)', [kind,id(entity),id(11),'30d',id(10),'2026-09-01T00:00:00Z']);
  }
  await db.query('INSERT INTO notification_log VALUES($1,$2,$3,$4,$5,$6)', ['document_expiry',id(4),id(11),'30d:2026-10-20',id(10),'2026-09-02T00:00:00Z']);
  await db.query("SET DateStyle='SQL, DMY'");
  await db.query(readFileSync(new URL('../supabase/migrations/20261004001200_expiry_notification_date_keys.sql', import.meta.url),'utf8'));
  await db.query("SET DateStyle='ISO, MDY'");
});
after(async () => { if(db) await db.end(); if(admin) { if(created) await admin.query(`DROP DATABASE ${name} WITH(FORCE)`); await admin.end(); } });
test('legacy stamps are retained and copied only to matching tenant and non-null current expiry', async () => {
  const {rows} = await db.query("SELECT entity_id,threshold_key,sent_at FROM notification_log WHERE threshold_key <> '30d' ORDER BY entity_id");
  assert.deepEqual(rows.map(r=>[r.entity_id,r.threshold_key]),[[id(1),'30d:2026-10-15'],[id(4),'30d:2026-10-20']]);
  assert.deepEqual(rows.map(r=>r.sent_at.toISOString()),['2026-09-01T00:00:00.000Z','2026-09-02T00:00:00.000Z']);
  assert.equal((await db.query("SELECT count(*)::int n FROM notification_log WHERE threshold_key='30d'")).rows[0].n,5);
});
test('current date deduplicates; renewal admits one new reservation; exact rollback preserves historical stamp', async () => {
  const insert = key => db.query('INSERT INTO notification_log(kind,entity_id,recipient_profile_id,threshold_key,tenant_id) VALUES($1,$2,$3,$4,$5)', ['contract_expiry',id(1),id(11),key,id(10)]);
  await assert.rejects(insert('30d:2026-10-15'), e=>e.code==='23505');
  await db.query("UPDATE contracts SET end_date='2027-10-15' WHERE id=$1",[id(1)]);
  await insert('30d:2027-10-15');
  await assert.rejects(insert('30d:2027-10-15'),e=>e.code==='23505');
  await db.query('DELETE FROM notification_log WHERE kind=$1 AND entity_id=$2 AND recipient_profile_id=$3 AND threshold_key=$4',['contract_expiry',id(1),id(11),'30d:2027-10-15']);
  await insert('30d:2027-10-15');
  assert.equal((await db.query('SELECT count(*)::int n FROM notification_log WHERE entity_id=$1',[id(1)])).rows[0].n,3);
});
test('old worker reservations fail while unrelated notification kinds keep their keys', async () => {
  await assert.rejects(db.query('INSERT INTO notification_log VALUES($1,$2,$3,$4,$5,now())',['document_expiry',id(5),id(11),'30d',id(10)]),e=>e.code==='23514');
  await db.query('INSERT INTO notification_log VALUES($1,$2,$3,$4,$5,now())',['task_overdue',id(5),id(11),'overdue',id(10)]);
});
