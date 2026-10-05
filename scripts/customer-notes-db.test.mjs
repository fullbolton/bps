import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace,actualFunction} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const root=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(root.hostname),'Synthetic local DB only');
const name=`bps_notes_commands_${process.pid}_${Date.now()}`,url=new URL(root);url.pathname='/'+name;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const client=()=>new Client({connectionString:url.href,query_timeout:10000,connectionTimeoutMillis:5000});
let admin,db,created=false;
async function user(c=db,actor=11,tenant=1){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);await c.query('SET ROLE authenticated');}
async function rollback(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');await db.query('RESET ROLE');}}
async function note(c=db,{action='create',noteId=null,company=101,tenant=1,actor=11,input={content:'Synthetic note',tag:'genel'}}={}){return (await c.query('SELECT * FROM note_execute_v1($1,$2,$3,$4,$5,$6::jsonb)',[action,noteId,id(company),id(tenant),id(actor),JSON.stringify(input)])).rows[0];}
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
 for(const file of ['20261005001000_company_commands.sql','20261005001100_contact_module_barrier.sql','20261005001200_note_module_commands.sql','20261005001300_company_note_direct_write_cutover.sql'])await db.query(sqlFile(file));
 console.log('Synthetic notes/contact DB:',(await db.query('SHOW server_version')).rows[0].server_version);
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
test('manager, operations and HR can create notes; author is resolved from the profile',async()=>{
 for(const actor of [11,21,22])await rollback(async()=>{await user(db,actor);const row=await note(db,{actor});assert.equal(row.author_id,id(actor));assert.equal(row.author_name,actor===11?'Manager A':actor===21?'operasyon':'ik');assert.equal(row.company_id,id(101));assert.equal(row.is_pinned,false);});
});
test('other roles cannot create, edit, pin or delete notes',async()=>{
 for(const actor of [23,24,25])await rollback(async()=>{await user(db,actor);await assert.rejects(note(db,{actor}),e=>e.code==='42501');});
});
test('operations and HR can edit only their own notes and cannot pin/delete',async()=>{
 for(const actor of [21,22]){
  await rollback(async()=>{await user(db,actor);const row=await note(db,{actor});const next=await note(db,{actor,action:'edit',noteId:row.id,input:{content:'Own edit'}});assert.equal(next.content,'Own edit');});
  for(const [action,input] of [['edit',{content:'Other edit'}],['pin',{is_pinned:true}],['delete',{}]])await rollback(async()=>{await user();const row=await note();await user(db,actor);await assert.rejects(note(db,{actor,action,noteId:row.id,input}),e=>e.code==='42501');});
 }
});
test('manager can pin and delete; missing targets never report a successful mutation',async()=>{
 await rollback(async()=>{await user();const row=await note();assert.equal((await note(db,{action:'pin',noteId:row.id,input:{is_pinned:true}})).is_pinned,true);assert.equal((await note(db,{action:'delete',noteId:row.id,input:{}})).id,row.id);await assert.rejects(note(db,{action:'delete',noteId:row.id,input:{}}),e=>e.code==='42501');});
});
test('even manager cannot edit a note through a different same-tenant company',async()=>{
 await rollback(async()=>{await user();const row=await note();await assert.rejects(note(db,{action:'edit',noteId:row.id,company:103,input:{content:'Wrong company'}}),e=>e.code==='42501');});
 for(const opts of [{company:102},{tenant:2},{actor:12}])await rollback(async()=>{await user();await assert.rejects(note(db,opts),e=>e.code==='42501');});
});
test('forged author, pin-at-create, invalid tags and blank/non-string content are rejected',async()=>{
 for(const input of [{content:'x',author_id:id(12)},{content:'x',author_name:'Fake'},{content:'x',is_pinned:true},{content:'x',tag:'bad'},{content:'\u00a0'},{content:1},{content:'x'.repeat(10001)}])await rollback(async()=>{await user();await assert.rejects(note(db,{input}),e=>e.code==='BN400');});
});
test('passive companies retain note creation but reject new contacts',async()=>{
 await rollback(async()=>{await user();assert.ok((await note(db,{company:103})).id);await assert.rejects(contact(db,{company:103}),e=>e.code==='23514');});
});
test('company/note direct writes are revoked, while both note and legacy contact commands still work',async()=>{
 for(const role of ['anon','authenticated','service_role'])for(const table of ['companies','notes'])assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) ok',[role,table,'INSERT,UPDATE,DELETE,TRUNCATE'])).rows[0].ok,false);
 await rollback(async()=>{await user();assert.ok((await contact()).id);assert.ok((await note()).id);assert.equal((await db.query("SELECT * FROM company_execute_v1('create',NULL,$1,$2,'{\"name\":\"After cutover\"}')",[id(1),id(11)])).rowCount,1);});
});
test('legacy full contact command preserves atomic primary selection and max five limit after cutover',async()=>{
 await rollback(async()=>{await user();const first=await contact();const second=await contact();assert.notEqual(first.id,second.id);assert.equal((await db.query('SELECT * FROM contacts WHERE is_primary')).rowCount,1);for(let n=0;n<3;n++)await contact(db,{primary:false});await assert.rejects(contact(),e=>e.code==='23514');});
 await rollback(async()=>{await user();const first=await contact();await db.query('SAVEPOINT invalid_contact');await assert.rejects(contact(db,{phone:null}),e=>e.code==='23514');await db.query('ROLLBACK TO invalid_contact');assert.equal((await db.query('SELECT id FROM contacts WHERE is_primary')).rows[0].id,first.id);});
});
test('legacy contact command rejects other roles and foreign targets',async()=>{
 await rollback(async()=>{await user(db,21);await assert.rejects(contact(),e=>e.code==='42501');});
 await rollback(async()=>{await user();await assert.rejects(contact(db,{company:102}),e=>e.code==='42501');});
 await rollback(async()=>{await user();const first=await contact();await assert.rejects(contact(db,{company:103,contactId:first.id}),e=>e.code==='42501');});
});
test('disabled module blocks note and contact commands, including the unchanged legacy signature',async()=>{
 for(const command of [note,contact])await rollback(async()=>{await off();await user();await assert.rejects(command(),e=>e.code==='BM001');});
});
test('config change wins: note and contact wait before profile locks and see disabled state',async()=>{
 for(const command of [note,contact]){
  const writer=client(),control=client();await writer.connect();await control.connect();let pending;
  try{await control.query('BEGIN');await control.query('SELECT * FROM tenant_module_config WHERE tenant_id=$1 FOR UPDATE',[id(1)]);await off(control);await user(writer);
   const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;pending=command(writer).then(value=>({value}),error=>({error}));await waitLock(pid);
   await db.query('BEGIN');await db.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE NOWAIT',[id(11)]);await db.query('ROLLBACK');await control.query('COMMIT');assert.equal((await pending).error.code,'BM001');
  }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query('UPDATE tenant_module_settings SET enabled=true WHERE tenant_id=$1',[id(1)]);await writer.end();await control.end();}
 }
});
test('note transaction holds the configuration lock until transaction completion',async()=>{
 const writer=client(),control=client();await writer.connect();await control.connect();let pending;
 try{await writer.query('BEGIN');await user(writer);await note(writer);const pid=(await control.query('SELECT pg_backend_pid() pid')).rows[0].pid;
  pending=control.query('UPDATE tenant_module_config SET revision=revision+1 WHERE tenant_id=$1',[id(1)]);await waitLock(pid);await writer.query('ROLLBACK');await pending;
 }finally{await writer.query('ROLLBACK');if(pending)await pending;await writer.end();await control.end();}
});
test('contact definer conversion rejects body drift instead of elevating altered code',async()=>{
 await rollback(async()=>{await db.query(sqlFile('20260911000100_contact_atomic_write.sql').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''));
  const definition=(await db.query("SELECT pg_get_functiondef('write_company_contact(uuid,uuid,text,text,text,text,boolean,text)'::regprocedure) d")).rows[0].d;
  await db.query(definition.replace('c.id=p_company_id AND c.tenant_id=v_tenant','true'));
  await assert.rejects(db.query(sqlFile('20261005001100_contact_module_barrier.sql').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')),/CONTACT_COMMAND_BODY_DRIFT/);
 });
});
test('write cutover rejects inherited table privileges',async()=>{
 await rollback(async()=>{await db.query(`CREATE ROLE notes_inherited_${process.pid}; GRANT UPDATE ON notes TO notes_inherited_${process.pid}; GRANT notes_inherited_${process.pid} TO authenticated`);
  await assert.rejects(db.query(sqlFile('20261005001300_company_note_direct_write_cutover.sql').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')),/CUSTOMER_WRITE_PRIVILEGE_DRIFT/);
 });
});

test('existing authenticated CSV contact insert remains compatible after company UPDATE is revoked',async()=>{
 await rollback(async()=>{await user();const result=await db.query('INSERT INTO contacts(company_id,full_name,email) VALUES($1,$2,$3) RETURNING *',[id(101),'Synthetic CSV','synthetic@example.test']);assert.equal(result.rows[0].created_by,id(11));});
});
test('role is rechecked after the profile lock for both contact and note writers',async()=>{
 for(const command of [note,contact]){
  const writer=client(),control=client();await writer.connect();await control.connect();let pending;
  try{await control.query('BEGIN');await control.query('SELECT * FROM profiles WHERE id=$1 FOR UPDATE',[id(11)]);await control.query("UPDATE tenant_memberships SET role='muhasebe' WHERE user_id=$1",[id(11)]);await user(writer);
   const pid=(await writer.query('SELECT pg_backend_pid() pid')).rows[0].pid;pending=command(writer).then(value=>({value}),error=>({error}));await waitLock(pid);await control.query('COMMIT');assert.equal((await pending).error.code,'42501');
  }finally{await control.query('ROLLBACK');if(pending)await pending;await db.query("UPDATE tenant_memberships SET role='yonetici' WHERE user_id=$1",[id(11)]);await writer.end();await control.end();}
 }
});

test('blank profile names are rejected instead of inventing a note author label',async()=>{
 await rollback(async()=>{await db.query("UPDATE profiles SET display_name=' ' WHERE id=$1",[id(11)]);await user();await assert.rejects(note(),/NOTE_AUTHOR_MISSING/);});
});
