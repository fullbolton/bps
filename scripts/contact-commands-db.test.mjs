import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_contact_commands_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=()=>new Client({connectionString:url.href,query_timeout:10000,connectionTimeoutMillis:5000});
let admin,db,created=false;
async function user(c=db,actor=11,tenant=1){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);await c.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
async function contact(c=db,{company=101,contactId=null,primary=true,phone='5550000000'}={}){return (await c.query('SELECT * FROM write_company_contact($1,$2,$3,$4,$5,$6,$7,$8)',[id(company),contactId,'Synthetic contact',null,phone,null,primary,null])).rows[0];}
async function off(c=db){await c.query("UPDATE tenant_module_settings SET enabled=false WHERE tenant_id=$1 AND module_key NOT IN ('tasks','talent','announcements')",[id(1)]);}
async function waitLock(pid){for(let n=0;n<100;n++){await db.query('SELECT pg_stat_clear_snapshot()');if((await db.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock')return;await new Promise(r=>setTimeout(r,10));}throw Error('Expected lock wait');}
before(async()=>{
 admin=new Client({connectionString:root.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;db=client();await db.connect();
 await db.query(fixture+active+verified+workspace+actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role')+`
 CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$SELECT auth.jwt()->>'role'$$;
 CREATE TABLE profiles(id uuid PRIMARY KEY,role text,display_name text,email text);
 INSERT INTO profiles(id,role,display_name) VALUES('${id(11)}','yonetici','Manager A'),('${id(12)}','operasyon','Foreign ops');
 CREATE TABLE companies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL REFERENCES tenants(id),name text NOT NULL,sector text,city text,status text DEFAULT 'aktif',risk text DEFAULT 'dusuk',legacy_mock_id text,created_by uuid REFERENCES profiles(id),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 INSERT INTO companies(id,tenant_id,name,status) VALUES('${id(101)}','${id(1)}','Synthetic A','aktif'),('${id(102)}','${id(2)}','Synthetic B','aktif'),('${id(103)}','${id(1)}','Other A','pasif');
 `);
 for(const [n,role] of ['operasyon','ik','muhasebe','goruntuleyici','partner'].entries()){
  await db.query('INSERT INTO profiles(id,role,display_name) VALUES($1,$2,$2)',[id(21+n),role]);await db.query('INSERT INTO tenant_memberships VALUES($1,$2,$3,$4)',[id(1),id(21+n),role,id(51+n)]);
 }
 const contacts=sqlFile('20260407000300_create_contacts.sql');await db.query(contacts.slice(0,contacts.indexOf('alter table public.contacts enable row level security;')));
 const notes=sqlFile('20260407000400_create_notes.sql');await db.query(notes.slice(0,notes.indexOf('-- RLS — notes')));
 await db.query('ALTER TABLE notes ADD COLUMN tenant_id uuid NOT NULL REFERENCES tenants(id)');
 for(const table of ['companies','contacts','notes'])await db.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated,service_role; CREATE POLICY read_${table} ON ${table} FOR SELECT TO authenticated USING(true)`);
 const roles=sqlFile('20260827000300_remove_partner_role.sql');const policyStart=roles.indexOf('CREATE POLICY contacts_insert_role_or_scope');const policyEnd=roles.indexOf('\n  );',policyStart);await db.query(roles.slice(policyStart,policyEnd+6));
 await db.query(sqlFile('20261005000100_tenant_module_foundation.sql'));
 const shared=sqlFile('20261005000200_task_module_gateway.sql');await db.query(shared.slice(shared.indexOf('CREATE FUNCTION public.workspace_module_enabled_v1'),shared.indexOf('-- Restrictive AND fences')));
 await db.query(sqlFile('20260915000200_contact_note_write_boundaries.sql'));
 await db.query(sqlFile('20260911000100_contact_atomic_write.sql'));
 for(const file of ['20261005001000_company_commands.sql','20261005001100_contact_module_barrier.sql','20261005001200_note_module_commands.sql','20261005001300_company_note_direct_write_cutover.sql','20261005001400_contact_remaining_commands.sql','20261005001500_contact_direct_write_cutover.sql'])await db.query(sqlFile(file));
 console.log('Synthetic contact commands DB:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});

async function command(c=db,{action='communication',contactId=null,company=101,tenant=1,actor=11,input={phone:'5551111111'}}={}) {
 return (await c.query('SELECT * FROM contact_execute_v1($1,$2,$3,$4,$5,$6::jsonb)',[action,contactId,id(company),id(tenant),id(actor),JSON.stringify(input)])).rows[0];
}
const importInput={full_name:'Imported contact',email:'synthetic@example.test',is_primary:false};
test('operations patches only supplied fields; absent email remains current',async()=>{
 await rollback(async()=>{await user();const row=await contact();await user(db,21);const edited=await command(db,{actor:21,contactId:row.id,input:{email:'new@example.test'}});assert.equal(edited.phone,row.phone);assert.equal(edited.email,'new@example.test');assert.equal(edited.full_name,row.full_name);});
});
test('empty channels, empty patch, injected name and malformed payload are rejected',async()=>{
 for(const input of [{phone:null},{},{full_name:'forged'},{phone:1}])await rollback(async()=>{await user();const row=await contact();await assert.rejects(command(db,{contactId:row.id,input}),e=>e.code==='BC400');});
});
test('manager deletes exactly the company-bound contact; repeated delete fails',async()=>{
 await rollback(async()=>{await user();const row=await contact();assert.equal((await command(db,{action:'delete',contactId:row.id,input:{}})).id,row.id);await assert.rejects(command(db,{action:'delete',contactId:row.id,input:{}}),e=>e.code==='42501');});
});
test('operations cannot delete/import; other roles cannot patch',async()=>{
 for(const action of ['delete','import'])await rollback(async()=>{await user();const row=await contact();await user(db,21);await assert.rejects(command(db,{actor:21,action,contactId:action==='delete'?row.id:null,input:action==='delete'?{}:importInput}),e=>e.code==='42501');});
 for(const actor of [22,23,24,25])await rollback(async()=>{await user();const row=await contact();await user(db,actor);await assert.rejects(command(db,{actor,contactId:row.id}),e=>e.code==='42501');});
});
test('wrong company, tenant, actor and foreign-company import are rejected',async()=>{
 for(const opts of [{company:103},{tenant:2},{actor:12}])await rollback(async()=>{await user();const row=await contact();await assert.rejects(command(db,{contactId:row.id,...opts}),e=>e.code==='42501');});
 await rollback(async()=>{await user();await assert.rejects(command(db,{action:'import',company:102,input:importInput}),e=>e.code==='42501');});
});
test('CSV preserves the existing primary and rejects duplicate primary instead of demoting',async()=>{
 await rollback(async()=>{await user();const row=await contact();await db.query('SAVEPOINT conflict');await assert.rejects(command(db,{action:'import',input:{...importInput,is_primary:true}}),e=>e.code==='BC409');await db.query('ROLLBACK TO conflict');assert.equal((await db.query('SELECT id FROM contacts WHERE is_primary')).rows[0].id,row.id);assert.equal((await command(db,{action:'import',input:importInput})).created_by,id(11));});
});
test('CSV has the same five-contact limit and passive-company guard',async()=>{
 await rollback(async()=>{await user();for(let n=0;n<5;n++)await command(db,{action:'import',input:importInput});await assert.rejects(command(db,{action:'import',input:importInput}),e=>e.code==='23514');});
 await rollback(async()=>{await user();await assert.rejects(command(db,{action:'import',company:103,input:importInput}),e=>e.code==='23514');});
});
test('effective contact DML is gone for app roles; legacy manager create/full edit still works',async()=>{
 for(const role of ['anon','authenticated','service_role'])assert.equal((await db.query("SELECT has_table_privilege($1,'contacts','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_any_column_privilege($1,'contacts','INSERT,UPDATE,REFERENCES') ok",[role])).rows[0].ok,false);
 await rollback(async()=>{await user();const row=await contact();assert.equal((await contact(db,{contactId:row.id,phone:'5552222222'})).phone,'5552222222');await assert.rejects(db.query('DELETE FROM contacts WHERE id=$1',[row.id]),e=>e.code==='42501');});
});
test('disabled customer module blocks every new action',async()=>{
 for(const action of ['communication','delete','import'])await rollback(async()=>{await user();const row=await contact();await db.query('RESET ROLE');await off();await user();await assert.rejects(command(db,{action,contactId:action==='import'?null:row.id,input:action==='import'?importInput:action==='delete'?{}:{phone:'5551111111'}}),e=>e.code==='BM001');});
});
test('configuration lock comes before profile; waiting command sees committed module closure',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{await control.query('BEGIN');await control.query('SELECT * FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);await off(control);await user(writer);
 const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;pending=command(writer,{action:'import',input:importInput}).then(value=>({value}),error=>({error}));await waitLock(pid);
 await db.query('BEGIN');await db.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE NOWAIT',[id(11)]);await db.query('ROLLBACK');await control.query('COMMIT');assert.equal((await pending).error.code,'BM001');
 }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query('UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1',[id(1)]);await writer.end();await control.end();}
});
test('role is rechecked after a blocked profile lock',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{await control.query('BEGIN');await control.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE',[id(11)]);await control.query("UPDATE tenant_memberships SET role='muhasebe' WHERE user_id=$1",[id(11)]);await user(writer);
 const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;pending=command(writer,{action:'import',input:importInput}).then(value=>({value}),error=>({error}));await waitLock(pid);await control.query('COMMIT');assert.equal((await pending).error.code,'42501');
 }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query("UPDATE tenant_memberships SET role='yonetici' WHERE user_id=$1",[id(11)]);await writer.end();await control.end();}
});
test('cutover refuses inherited column UPDATE grants',async()=>{
 await rollback(async()=>{await db.query(`CREATE ROLE contacts_inherited_${process.pid}; GRANT UPDATE(phone) ON contacts TO contacts_inherited_${process.pid}; GRANT contacts_inherited_${process.pid} TO authenticated`);await assert.rejects(db.query(sqlFile('20261005001500_contact_direct_write_cutover.sql').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')),/CONTACT_WRITE_PRIVILEGE_DRIFT/);});
});

test('concurrent partial edits merge against the locked row, not a stale client snapshot',async()=>{
 let row;await user();row=await contact();await db.query('RESET ROLE');
 const first=client(),second=client();await first.connect();await second.connect();let pending;
 try{await first.query('BEGIN');await user(first);await command(first,{contactId:row.id,input:{email:'concurrent@example.test'}});await user(second);
 const pid=(await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;pending=command(second,{contactId:row.id,input:{phone:'5553333333'}});await waitLock(pid);await first.query('COMMIT');const edited=await pending;assert.equal(edited.email,'concurrent@example.test');assert.equal(edited.phone,'5553333333');
 }finally{await first.query('ROLLBACK');if(pending)await pending;await db.query('DELETE FROM contacts WHERE id=$1',[row.id]);await first.end();await second.end();}
});
