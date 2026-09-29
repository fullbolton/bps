import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {entries,source,render,attachmentBody} from './talent-module-gates.mjs';
import {sqlFile,fixture,active,verified,workspace} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const dbName=`bps_talent_gates_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,created=false,targetUrl;
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${dbName}`);created=true;targetUrl=new URL(url);targetUrl.pathname='/'+dbName;
 db=new Client({connectionString:targetUrl.href,query_timeout:10000});await db.connect();await db.query(fixture+active+verified+workspace);
 await db.query(`CREATE FUNCTION public.current_user_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT role FROM public.tenant_memberships WHERE user_id=auth.uid() AND tenant_id=public.current_user_verified_tenant() $$;
 CREATE TABLE profiles(id uuid PRIMARY KEY);
 INSERT INTO profiles VALUES('${id(11)}'),('${id(12)}');
 SET check_function_bodies=off;`);
 // Composite types are needed to compile declarations, but disabled-path tests do not execute business statements.
 const names=new Set(entries.flatMap(e=>[...e.body.matchAll(/\b(?:DECLARE\s+)?\w+\s+public\.(\w+)(?:%ROWTYPE)?\s*[;,]/gi)].map(m=>m[1])));
 for(const name of names)if(name!=='profiles')await db.query(`CREATE TABLE public.${name}(id uuid,tenant_id uuid,actor_id uuid,creator_id uuid,name text,query jsonb,archived_at timestamptz,person_ids uuid[],revision integer,ready boolean,category text,person_id uuid,filename text,mime text,size bigint,sha256 text,created_at timestamptz)`);
 for(const name of ['talent_shared_views','talent_call_lists'])if(!names.has(name))await db.query(`CREATE TABLE public.${name}(id uuid,tenant_id uuid,creator_id uuid,name text,query jsonb,archived_at timestamptz,person_ids uuid[])`);
 const scope=source('talent_assert_scope','20260914000200_talent_people.sql','read');await db.query(scope.declaration);await db.query(`REVOKE ALL ON FUNCTION talent_assert_scope(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role`);
 await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 const barrier=source('workspace_require_module_write_v1','20260928001000_task_module_gateway.sql','write');await db.query(barrier.declaration);await db.query('REVOKE ALL ON FUNCTION workspace_require_module_write_v1(uuid,text[]) FROM PUBLIC,anon,authenticated,service_role');
 for(const e of entries){await db.query(e.declaration);await db.query(`REVOKE ALL ON FUNCTION ${e.signature} FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION ${e.signature} TO authenticated`);}
 for(const signature of ['talent_import_prepare_v1(uuid,uuid,uuid,text,jsonb)','talent_call_list_people_base(uuid,uuid,uuid)','talent_conversation_list_base(uuid,uuid,uuid,integer)'])await db.query(`CREATE FUNCTION public.${signature} RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$;REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC,anon,authenticated,service_role`);
 await db.query(`CREATE FUNCTION public.talent_attachment_access(p_id uuid,p_upload boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$${attachmentBody}$body$;REVOKE ALL ON FUNCTION talent_attachment_access(uuid,boolean) FROM PUBLIC,anon,service_role;GRANT EXECUTE ON FUNCTION talent_attachment_access(uuid,boolean) TO authenticated`);
 await db.query(render());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${dbName} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{await fn();}finally{await db.query('ROLLBACK');}}
async function claims(client=db,actor=11,tenant=1){await client.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);}
function call(e){const types=e.signature.slice(e.signature.indexOf('(')+1,-1).split(',');return `SELECT public.${e.name}(${types.map((t,i)=>i<2?`'${id(i===0?11:1)}'::uuid`:`NULL::${t}`).join(',')})`;}
for(const e of entries)test(`${e.name} rejects disabled talent before its business body`,()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(call(e)),err=>err.code==='BM001');
}));
test('all patched bodies preserve their original statements and acquire config before original locks',async()=>{
 for(const e of entries){const body=(await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[e.signature])).rows[0].prosrc;assert.equal(body,e.body.replace('\nBEGIN\n','\nBEGIN\n'+e.guard));}
});
test('neutral identity scope still serves operations when talent is off',()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);await claims();await db.query(`SELECT public.talent_assert_scope('${id(11)}','${id(1)}')`);
}));
test('enabled read executes the actual saved-view body and returns only the selected tenant',()=>run(async()=>{
 await db.query('INSERT INTO talent_shared_views(id,tenant_id,creator_id,name,query) VALUES($1,$2,$3,$4,$5),($6,$7,$3,$8,$5)',[id(50),id(1),id(11),'A','{}',id(51),id(2),'B']);await claims();await db.query('SET LOCAL ROLE authenticated');const r=await db.query(`SELECT talent_shared_views_read('${id(11)}','${id(1)}') v`);assert.equal(r.rows[0].v.rows.length,1);assert.equal(r.rows[0].v.rows[0].name,'A');
}));
test('actor spoof, foreign tenant and missing membership fail before business reads',async()=>{
 for(const [actor,tenant] of [[12,1],[11,2],[99,1]])await run(async()=>{await claims(db,actor,tenant);await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(`SELECT talent_shared_views_read('${id(11)}','${id(1)}')`));});
});
test('prepare-worker requires staffing as well as talent',()=>run(async()=>{
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='staffing'`);await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(call(entries.find(e=>e.name==='talent_prepare_worker'))),e=>e.code==='BM001');
}));
test('anonymous and service cannot execute any patched entry, including internal read helper',async()=>{
 for(const e of entries)for(const role of ['anon','service_role'])assert.equal((await db.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') yes',[role,e.signature])).rows[0].yes,false);
 for(const role of ['anon','service_role','authenticated'])assert.equal((await db.query('SELECT has_function_privilege($1,\'public.workspace_require_module_read_v1(uuid,text[])\',\'EXECUTE\') yes',[role])).rows[0].yes,false);
});
test('write after waiting on settings lock observes committed disabled state',async()=>{
 const waiter=new Client({connectionString:targetUrl.href,query_timeout:5000});await waiter.connect();
 try{await db.query('BEGIN');await db.query(`SELECT FROM tenant_module_config WHERE tenant_id='${id(1)}' FOR UPDATE`);await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);
 await claims(waiter);await waiter.query('SET ROLE authenticated');const pending=waiter.query(call(entries.find(e=>e.name==='talent_shared_view_archive'))).then(()=>null,e=>e);
 // Observe a real lock wait, not an assumed schedule.
 const pid=waiter.processID;let waiting=false;
 for(let i=0;i<100;i++){const rows=await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid]);if(rows.rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
 assert.ok(waiting);await db.query('COMMIT');assert.equal((await pending).code,'BM001');
 }finally{await db.query('ROLLBACK');await db.query(`UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='talent'`);await waiter.end();}
});

async function originalState(){
 await db.query('DROP FUNCTION workspace_require_module_read_v1(uuid,text[])');
 await db.query(`CREATE OR REPLACE FUNCTION public.talent_attachment_access(p_id uuid,p_upload boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $body$${attachmentBody}$body$`);
 for(const e of entries)await db.query(e.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION'));
}
const migrationBody=()=>render().replace(/\nBEGIN;\n/,'\n').replace(/COMMIT;\n$/,'');
test('last-body drift rolls back every earlier patch and helper creation',()=>run(async()=>{
 await originalState();const last=entries.at(-1);await db.query(last.declaration.replace(/^CREATE (?:OR REPLACE )?FUNCTION/i,'CREATE OR REPLACE FUNCTION').replace('BEGIN','BEGIN\n -- drift'));
 await db.query('SAVEPOINT candidate');await assert.rejects(db.query(migrationBody()),e=>e.message.includes('BODY_DRIFT'));await db.query('ROLLBACK TO candidate');
 assert.equal((await db.query("SELECT to_regprocedure('public.workspace_require_module_read_v1(uuid,text[])') p")).rows[0].p,null);
 assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[entries[0].signature])).rows[0].prosrc,entries[0].body);
}));
test('exposed internal aliases stop migration instead of leaving a bypass',()=>run(async()=>{
 await originalState();await db.query('GRANT EXECUTE ON FUNCTION talent_call_list_people_base(uuid,uuid,uuid) TO authenticated');
 await assert.rejects(db.query(migrationBody()),e=>e.message.includes('INTERNAL_ACL'));
}));
test('a newly exposed actor-scoped overload requires review',()=>run(async()=>{
 await originalState();await db.query(`CREATE FUNCTION talent_shared_views_read(p_actor uuid,p_tenant uuid,p_extra text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;GRANT EXECUTE ON FUNCTION talent_shared_views_read(uuid,uuid,text) TO authenticated`);
 await assert.rejects(db.query(migrationBody()),e=>e.message.includes('UNREVIEWED_ENDPOINT'));
}));

test('attachment policy helper denies downloads and new uploads when talent is off',()=>run(async()=>{
 await db.query(`INSERT INTO talent_attachments(id,tenant_id,actor_id,ready,category) VALUES('${id(60)}','${id(1)}','${id(11)}',true,'photo'),('${id(61)}','${id(1)}','${id(11)}',false,'photo')`);
 await claims();await db.query('SET LOCAL ROLE authenticated');assert.equal((await db.query(`SELECT talent_attachment_access('${id(60)}',false) a,talent_attachment_access('${id(61)}',true) b`)).rows[0].a,true);
 await db.query('RESET ROLE');await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);await db.query('SET LOCAL ROLE authenticated');
 assert.deepEqual((await db.query(`SELECT talent_attachment_access('${id(60)}',false) a,talent_attachment_access('${id(61)}',true) b`)).rows[0],{a:false,b:false});
}));
test('attachment access retains tenant owner ready and onboarding rules',()=>run(async()=>{
 await db.query(`INSERT INTO talent_attachments(id,tenant_id,actor_id,ready,category) VALUES('${id(60)}','${id(1)}','${id(11)}',true,'onboarding'),('${id(61)}','${id(1)}','${id(99)}',false,'photo'),('${id(62)}','${id(2)}','${id(12)}',true,'photo')`);
 await db.query(`UPDATE tenant_memberships SET role='operasyon' WHERE user_id='${id(11)}'`);await claims();await db.query('SET LOCAL ROLE authenticated');
 for(const [record,upload] of [[60,false],[61,true],[62,false],[99,false]])assert.equal((await db.query('SELECT talent_attachment_access($1,$2) allowed',[id(record),upload])).rows[0].allowed,false);
}));
test('enabled write executes original archive operation without losing authorization',()=>run(async()=>{
 await db.query(`INSERT INTO talent_shared_views(id,tenant_id,creator_id,name,query) VALUES('${id(70)}','${id(1)}','${id(11)}','Keep','{}')`);await claims();await db.query('SET LOCAL ROLE authenticated');
 await db.query(`SELECT talent_shared_view_archive('${id(11)}','${id(1)}','${id(70)}')`);await db.query('RESET ROLE');
 assert.ok((await db.query(`SELECT archived_at FROM talent_shared_views WHERE id='${id(70)}'`)).rows[0].archived_at);
}));

test('actual person detail withholds assignments when staffing is off and restores them when on',()=>run(async()=>{
 const projection=await import('./talent-assignment-projection.mjs');
 await db.query(projection.render().replace(/\nBEGIN;\n/,'\n').replace(/COMMIT;\n$/,''));
 await db.query(`ALTER TABLE talent_people ADD COLUMN worker_id uuid;
 ALTER TABLE profiles ADD COLUMN display_name text;
 CREATE TABLE talent_person_events(id bigint,kind text,revision integer,changed_fields text[],occurred_at timestamptz,actor_id uuid,tenant_id uuid,person_id uuid);
 CREATE TABLE ops_assignments(id uuid,tenant_id uuid,request_id uuid,worker_id uuid,work_date date,removed_at timestamptz);
 CREATE TABLE ops_daily_requests(id uuid,tenant_id uuid,company_id uuid,location_id uuid,position text,lifecycle text);
 CREATE TABLE companies(id uuid,tenant_id uuid,name text);
 CREATE TABLE ops_locations(id uuid,tenant_id uuid,company_id uuid,name text);
 CREATE FUNCTION talent_canonical_person(uuid,uuid) RETURNS uuid LANGUAGE sql AS $$SELECT $2$$;
 CREATE FUNCTION talent_person_family(uuid,uuid) RETURNS SETOF uuid LANGUAGE sql AS $$SELECT $2$$;
 CREATE FUNCTION talent_person_json(public.talent_people) RETURNS jsonb LANGUAGE sql AS $$SELECT to_jsonb($1)$$;
 INSERT INTO talent_people(id,tenant_id,worker_id) VALUES('${id(80)}','${id(1)}','${id(81)}');
 INSERT INTO companies VALUES('${id(82)}','${id(1)}','Company');
 INSERT INTO ops_locations VALUES('${id(83)}','${id(1)}','${id(82)}','Branch');
 INSERT INTO ops_daily_requests VALUES('${id(84)}','${id(1)}','${id(82)}','${id(83)}','Guard','active');
 INSERT INTO ops_assignments VALUES('${id(85)}','${id(1)}','${id(84)}','${id(81)}','2026-09-29',NULL);`);
 await claims();
 const fetch=async()=>{await db.query('SET LOCAL ROLE authenticated');const v=(await db.query(`SELECT talent_person_detail('${id(11)}','${id(1)}','${id(80)}') v`)).rows[0].v;await db.query('RESET ROLE');return v;};
 assert.equal((await fetch()).assignments.length,1);
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='staffing'`);
 const off=await fetch();assert.equal(off.staffingAvailable,false);assert.deepEqual(off.assignments,[]);assert.equal(off.person.worker_id,id(81));
 // Prove the disabled branch never executes the assignment query, even through SECURITY DEFINER.
 await db.query('DROP TABLE ops_assignments');assert.deepEqual((await fetch()).assignments,[]);
 await db.query(`CREATE TABLE ops_assignments(id uuid,tenant_id uuid,request_id uuid,worker_id uuid,work_date date,removed_at timestamptz);
 INSERT INTO ops_assignments VALUES('${id(85)}','${id(1)}','${id(84)}','${id(81)}','2026-09-29',NULL);
 UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='staffing'`);
 const on=await fetch();assert.equal(on.staffingAvailable,true);assert.equal(on.assignments[0].companyName,'Company');
 await db.query(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='talent'`);
 await db.query('SET LOCAL ROLE authenticated');await assert.rejects(db.query(`SELECT talent_person_detail('${id(11)}','${id(1)}','${id(80)}')`),e=>e.code==='BM001');
}));

test('assignment projection rejects an unexpected source body without changing it',()=>run(async()=>{
 const p=await import('./talent-assignment-projection.mjs');
 await db.query(`CREATE OR REPLACE FUNCTION talent_person_detail(p_actor_id uuid,p_tenant_id uuid,p_person_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$BEGIN RETURN '{}'::jsonb;END$$`);
 await db.query('SAVEPOINT patch');await assert.rejects(db.query(p.render().replace(/\nBEGIN;\n/,'\n').replace(/COMMIT;\n$/,'')),e=>e.message.includes('BODY_DRIFT'));
 await db.query('ROLLBACK TO patch');assert.equal((await db.query('SELECT prosrc FROM pg_proc WHERE oid=$1::regprocedure',[p.signature])).rows[0].prosrc,"BEGIN RETURN '{}'::jsonb;END");
}));
