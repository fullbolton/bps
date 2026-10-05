import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {entries,extract,render} from './reporting-merge-fix.mjs';
import {fixture,active,verified,actualFunction} from './fixtures/security-boundary-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const name=`bps_reporting_merge_${process.pid}_${Date.now()}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
let admin,db,target,created=false;
const sql=f=>readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8');
const rows=(sourceId='row1',code='C',day='2026-01-01',minutes=480)=>[{sourceId,locationCode:'L',personCode:code,day,slotCode:'day',minutes}];
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${name}`);created=true;target=new URL(url);target.pathname='/'+name;db=new Client({connectionString:target.href,query_timeout:5000});await db.connect();await db.query(fixture+active+verified);await db.query(actualFunction('20260926000100_multi_workspace_cutover.sql','current_user_role'));
 await db.query(`CREATE TABLE profiles(id uuid PRIMARY KEY);INSERT INTO profiles VALUES('${id(11)}');
 CREATE TABLE companies(tenant_id uuid,id uuid,PRIMARY KEY(tenant_id,id));INSERT INTO companies VALUES('${id(1)}','${id(20)}');
 CREATE TABLE ops_locations(tenant_id uuid,company_id uuid,id uuid PRIMARY KEY,name text,external_code text,UNIQUE(tenant_id,company_id,id));INSERT INTO ops_locations VALUES('${id(1)}','${id(20)}','${id(21)}','Synthetic branch','L');
 CREATE TABLE talent_people(tenant_id uuid,id uuid,name text,city text,merged_into_id uuid,worker_id uuid,revision integer DEFAULT 1,PRIMARY KEY(tenant_id,id));
 INSERT INTO talent_people(tenant_id,id,name,city) VALUES('${id(1)}','${id(30)}','Donor','City'),('${id(1)}','${id(31)}','Primary','City'),('${id(1)}','${id(32)}','Other','City'),('${id(2)}','${id(33)}','Foreign','City');
 CREATE TABLE talent_merge_commands(tenant_id uuid,actor_id uuid,command_id uuid,payload jsonb,result jsonb,save_command uuid DEFAULT gen_random_uuid(),PRIMARY KEY(tenant_id,actor_id,command_id));`);
 await db.query(sql('20260928000100_project_reporting_foundation.sql'));
 await db.query(sql('20260928000200_project_reporting_actual_import.sql'));
 await db.query(sql('20260928000300_project_reporting_monthly_report.sql'));
 await db.query(sql('20260928000400_project_reporting_work_details.sql'));
 await db.query(extract('20260927000500_pool_merge_and_contacts.sql','talent_canonical_person','').declaration);
 // Merge scope delegates to the real reporting scope for this isolated lock-path fixture.
 await db.query("CREATE FUNCTION talent_assert_scope(uuid,uuid) RETURNS void LANGUAGE sql AS 'SELECT public.reporting_assert_scope($1,$2,true)'");
 await db.query(entries[7].declaration);
 await db.query(`INSERT INTO reporting_projects(tenant_id,id,company_id,code,name,kind,created_by) VALUES('${id(1)}','${id(40)}','${id(20)}','P','Synthetic project','idp','${id(11)}');
 INSERT INTO reporting_project_locations VALUES('${id(1)}','${id(40)}','${id(20)}','${id(21)}','2026-01-01',NULL);
 INSERT INTO reporting_periods(tenant_id,project_id,month,created_by) VALUES('${id(1)}','${id(40)}','2026-01-01','${id(11)}');
 INSERT INTO reporting_person_codes(tenant_id,project_id,source,code,person_id,created_by) VALUES('${id(1)}','${id(40)}','excel','C','${id(30)}','${id(11)}'),('${id(1)}','${id(40)}','excel','M','${id(31)}','${id(11)}');`);
 await auth();const b=await prepare(50);await finish(b);await db.query('RESET ROLE');
 // Reproduce the old failure using the actual reporting validator.
 await run(async()=>{await merge();await assert.rejects(validate(),e=>e.message==='REPORT_PERSON_UNMAPPED');});
 await db.query(render());
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${name} WITH(FORCE)`);await admin.end();}});
async function auth(c=db){await c.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(11),active_tenant_id:id(1)})]);await c.query('SET ROLE authenticated');}
async function run(fn){await db.query('BEGIN');try{await db.query('RESET ROLE');await fn();}finally{await db.query('ROLLBACK');}}
const merge=()=>db.query('UPDATE talent_people SET merged_into_id=$1 WHERE tenant_id=$2 AND id=$3',[id(31),id(1),id(30)]);
const validate=(r=rows())=>db.query('SELECT reporting_import_validate($1,$2,$3,$4,$5) v',[id(1),id(40),'2026-01-01','excel',JSON.stringify(r)]);
async function prepare(command,r=rows(),c=db){return (await c.query('SELECT reporting_import_prepare($1,$2,$3,$4,$5,$6,$7) v',[id(11),id(1),id(40),id(command),'2026-01','excel',JSON.stringify(r)])).rows[0].v.batchId;}
const finish=b=>db.query('SELECT reporting_import_finish($1,$2,$3,true)',[id(11),id(1),b]);
const mapping=person=>db.query("SELECT reporting_person_code_set($1,$2,$3,2,'excel','C',$4) v",[id(11),id(1),id(40),id(person)]);
test('merged code resolves to primary; historical source identity accepts corrections without rewriting history',()=>run(async()=>{
 await merge();const v=(await validate()).rows[0].v[0];assert.equal(v.personId,id(31));assert.equal(v.status,'unchanged');
 await auth();const b=await prepare(51,rows('row1','C','2026-01-01',420));await finish(b);await db.query('RESET ROLE');const a=(await db.query('SELECT person_id,minutes FROM reporting_actuals')).rows[0];assert.equal(a.person_id,id(30));assert.equal(a.minutes,420);
}));
test('canonical duplicate through another code/source row is rejected',()=>run(async()=>{
 await merge();await assert.rejects(validate(rows('different','M')),e=>e.message==='REPORT_WORK_DUPLICATE');
}));
test('same canonical mapping is idempotent while used code cannot move to another person or tenant',async()=>{
 await run(async()=>{await merge();await auth();assert.equal((await mapping(31)).rows[0].v,2);assert.equal((await mapping(30)).rows[0].v,2);await assert.rejects(mapping(32),e=>e.message==='REPORT_MAPPING_USED');});
 await run(async()=>{await auth();await assert.rejects(mapping(33),e=>e.message==='REPORT_PERSON_UNMAPPED');});
});
test('mapping list, detail names and monthly distinct people agree; minutes stay intact',()=>run(async()=>{
 await auth();const b=await prepare(52,rows('row2','M','2026-01-02',300));await finish(b);await db.query('RESET ROLE');await merge();await auth();
 const mappings=(await db.query("SELECT reporting_import_people($1,$2,$3,'excel',ARRAY['C'],'Pr') v",[id(11),id(1),id(40)])).rows[0].v;
 assert.equal(mappings.mappings[0].personId,id(31));assert.equal(mappings.mappings[0].name,'Primary');
 const report=(await db.query("SELECT reporting_monthly_report($1,$2,$3,'2026-01',0) v",[id(11),id(1),id(40)])).rows[0].v;
 assert.equal(report.totals.people,1);assert.equal(report.totals.minutes,780);assert.equal(report.totals.records,2);assert.equal(report.rows[0].people,1);
 const details=(await db.query("SELECT reporting_work_details($1,$2,$3,'2026-01',NULL,0) v",[id(11),id(1),id(40)])).rows[0].v;assert.ok(details.rows.every(r=>r.personId===id(31)&&r.personName==='Primary'));
}));
test('preview prepared before a merge cannot silently approve a changed identity',()=>run(async()=>{
 await auth();const b=await prepare(53,rows('row3','C','2026-01-03'));await db.query('RESET ROLE');await merge();await auth();await assert.rejects(finish(b),e=>e.message==='REPORT_CONFLICT');
}));
test('merge fails promptly while reporting holds its shared fence',async()=>{
 const c=new Client({connectionString:target.href,query_timeout:5000});await c.connect();
 try{await db.query('BEGIN');await auth();await prepare(54,rows('row4','C','2026-01-04'));await auth(c);
 await assert.rejects(c.query('SELECT talent_merge_apply($1,$2,$3,$4,$5,$6,$7,$8,true,true)',[id(11),id(1),id(80),id(30),id(31),id(31),'0'.repeat(32),{name:'left',city:'left',district:'left',gender:'left',birthDate:'left'}]),e=>e.message==='TALENT_MERGE_BUSY');
 }finally{await db.query('ROLLBACK');await c.end();}
});
test('waiting import sees committed merge identity after acquiring the fence',async()=>{
 const c=new Client({connectionString:target.href,query_timeout:5000});await c.connect();
 try{await db.query('BEGIN');await db.query('RESET ROLE');await db.query("SELECT pg_advisory_xact_lock(hashtextextended('bps:reporting-merge:'||$1,0))",[id(1)]);await merge();await auth(c);
 const pending=prepare(55,rows('row5','C','2026-01-05'),c);let waiting=false;
 for(let i=0;i<100;i++){if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[c.processID])).rows[0]?.wait_event_type==='Lock'){waiting=true;break;}await new Promise(r=>setTimeout(r,10));}
 assert.ok(waiting);await db.query('COMMIT');const b=await pending;assert.equal((await db.query('SELECT resolved FROM reporting_imports WHERE id=$1',[b])).rows[0].resolved[0].personId,id(31));
 }finally{await db.query('ROLLBACK');await db.query('RESET ROLE');await db.query('UPDATE talent_people SET merged_into_id=NULL');await db.query('DELETE FROM reporting_imports WHERE command_id=$1',[id(55)]);await c.end();}
});
test('multi-hop merge resolves historical records to the final primary',()=>run(async()=>{
 await merge();await db.query('UPDATE talent_people SET merged_into_id=$1 WHERE id=$2',[id(32),id(31)]);
 assert.equal((await validate()).rows[0].v[0].personId,id(32));
}));
test('existing source row cannot be changed to a genuinely different identity',()=>run(async()=>{
 await db.query('UPDATE reporting_person_codes SET person_id=$1 WHERE code=$2',[id(32),'C']);
 await assert.rejects(validate(),e=>e.message==='REPORT_SOURCE_ID_CHANGED');
}));
test('tenant scope rejects cross-workspace reads and writes',async()=>{
 await run(async()=>{await auth();await assert.rejects(db.query("SELECT reporting_monthly_report($1,$2,$3,'2026-01',0)",[id(11),id(2),id(40)]),e=>e.message==='REPORT_SCOPE');});
 await run(async()=>{await auth();await assert.rejects(db.query("SELECT reporting_person_code_set($1,$2,$3,2,'excel','C',$4)",[id(11),id(2),id(40),id(33)]),e=>e.message==='REPORT_SCOPE');});
});
