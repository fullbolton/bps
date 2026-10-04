// Executes production preview SQL on synthetic relation fixtures, never remote data.
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sqlFile,fixture,active,verified,workspace} from './fixtures/module-database.mjs';
const {Client}=createRequire(import.meta.url)('pg');
const url=new URL(process.env.BPS_MODULE_TEST_DATABASE_URL??'postgres://bps_module_test@127.0.0.1:55439/postgres');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname));
const dbName=`bps_preview_${process.pid}_${Date.now()}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const keys=['customers','tasks','calendar','documents','contracts','talent','staffing','reporting','finance','announcements'];
const all=v=>Object.fromEntries(keys.map(k=>[k,v]));
let admin,db,created=false;
const tables={talent_attachments:'ready boolean,cleaned boolean',tasks:'status text,company_id uuid,appointment_id uuid,contract_id uuid',appointments:'status text',contracts:'status text',talent_import_rows:'status text',staffing_demands:'status text',ops_daily_requests:'lifecycle text,work_date date',ops_assignments:'removed_at timestamptz,work_date date',ops_work_records:'status text',ops_fixed_roster:'cancelled boolean,ends_on date',ops_schedules:'plan jsonb',reporting_periods:'status text',reporting_imports:'status text'};
before(async()=>{
 admin=new Client({connectionString:url.href});await admin.connect();await admin.query(`CREATE DATABASE ${dbName}`);created=true;
 const target=new URL(url);target.pathname='/'+dbName;db=new Client({connectionString:target.href,query_timeout:10000});await db.connect();
 await db.query(fixture+active+verified+workspace);await db.query(sqlFile('20260928000900_tenant_module_foundation.sql'));
 for(const [name,columns] of Object.entries(tables))await db.query(`CREATE TABLE public.${name}(tenant_id uuid NOT NULL,${columns})`);
 await db.query(sqlFile('20260929000200_module_change_preview.sql'));
});
after(async()=>{if(db)await db.end();if(admin){if(created)await admin.query(`DROP DATABASE ${dbName} WITH(FORCE)`);await admin.end();}});
async function run(fn){await db.query('BEGIN');try{return await fn();}finally{await db.query('ROLLBACK');}}
async function claims(actor=11,tenant=1){await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(actor),active_tenant_id:id(tenant)})]);}
async function preview(states=all(false),actor=11,tenant=1,revision='1'){
 return (await db.query('SELECT public.preview_workspace_modules_v1($1,$2,$3,$4) value',[id(actor),id(tenant),revision,states])).rows[0].value;
}
test('manager sees all sixteen checks with no settings mutation or save authorization',()=>run(async()=>{
 await claims();await db.query('SET LOCAL ROLE authenticated');const value=await preview();assert.equal(value.checks.length,16);assert.ok(value.checks.every(c=>c.blocking===false));assert.equal(value.mutationAvailable,false);assert.equal(value.advisoryOnly,true);
 await db.query('RESET ROLE');assert.equal((await db.query('SELECT count(*)::int n FROM tenant_module_changes')).rows[0].n,2);
 assert.ok((await db.query('SELECT enabled FROM tenant_module_settings')).rows.every(r=>r.enabled));
}));
test('anon service and non-manager cannot use the preview',async()=>{
 for(const role of ['anon','service_role'])await run(async()=>{await claims();await db.query(`SET LOCAL ROLE ${role}`);await assert.rejects(preview(),e=>e.code==='42501');});
 await run(async()=>{await claims(12,2);await db.query('SET LOCAL ROLE authenticated');await assert.rejects(preview(all(false),12,2),e=>e.code==='42501');});
});
test('cross tenant, actor mismatch, removed membership and stale revision reject',async()=>{
 for(const [actor,tenant,revision] of [[12,1,'1'],[11,2,'1'],[11,1,'2']])await run(async()=>{await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(preview(all(false),actor,tenant,revision));});
 await run(async()=>{await claims();await db.query(`DELETE FROM tenant_memberships WHERE user_id='${id(11)}'`);await db.query('SET LOCAL ROLE authenticated');await assert.rejects(preview());});
});
test('invalid JSON shapes and coerced booleans reject before any business scan',async()=>{
 for(const input of [null,[],{}, {...all(true),tasks:'false'}, {...all(true),extra:true}])await run(async()=>{await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(preview(input),e=>e.code==='22023');});
});
test('dependencies report requested state, do not silently enable or cascade disable',()=>run(async()=>{
 await claims();await db.query('SET LOCAL ROLE authenticated');const requested={...all(true),customers:false};const v=await preview(requested);
 assert.equal(v.dependencies.length,6);assert.deepEqual(v.disabled,['customers']);assert.deepEqual(v.requested,requested);assert.equal(v.checks.length,1);assert.equal(v.checks[0].code,'customer_linked_tasks');
}));
test('no-change draft scans no business tables and bigint revision stays exact',()=>run(async()=>{
 await db.query("UPDATE tenant_module_config SET revision=9223372036854775807 WHERE tenant_id=$1",[id(1)]);
 await claims();await db.query('SET LOCAL ROLE authenticated');const v=await preview(all(true),11,1,'9223372036854775807');assert.deepEqual(v.checks,[]);assert.equal(v.context.configRevision,'9223372036854775807');
}));
const scenarios=[
 ['tasks','unfinished_tasks',"status",['gecikti'],'tamamlandi'],
 ['appointments','unfinished_appointments','status',['ertelendi'],'iptal'],
 ['contracts','unfinished_contracts','status',['imza_bekliyor'],'feshedildi'],
 ['talent_import_rows','pending_talent_import','status',['pending'],'reverted'],
 ['staffing_demands','open_staffing_demands','status',['kismi_doldu'],'tamamen_doldu'],
 ['ops_daily_requests','upcoming_requests','lifecycle,work_date',['active','2099-01-01'],null],
 ['ops_assignments','upcoming_assignments','removed_at,work_date',[null,'2099-01-01'],null],
 ['ops_work_records','unapproved_work','status',['returned'],'approved'],
 ['ops_fixed_roster','active_roster','cancelled,ends_on',[false,null],null],
 ['ops_schedules','active_schedules','plan',[JSON.stringify({archived:false,end:'2099-01-01'})],null],
 ['reporting_periods','open_reporting_periods','status',['open'],'closed'],
 ['reporting_imports','pending_reporting_imports','status',['pending'],'approved'],
];
for(const [table,code,columns,values,terminal] of scenarios)test(`${code}: own tenant blocks, foreign tenant and completed history do not`,()=>run(async()=>{
 const insert=tenant=>db.query(`INSERT INTO ${table}(tenant_id,${columns}) VALUES($1,${values.map((_,i)=>'$'+(i+2)).join(',')})`,[id(tenant),...values]);
 await insert(2);await claims();await db.query('SET LOCAL ROLE authenticated');assert.equal((await preview()).checks.find(c=>c.code===code).blocking,false);
 await db.query('RESET ROLE');await insert(1);await db.query('SET LOCAL ROLE authenticated');assert.equal((await preview()).checks.find(c=>c.code===code).blocking,true);
 await db.query('RESET ROLE');
 if(terminal)await db.query(`UPDATE ${table} SET status=$1 WHERE tenant_id=$2`,[terminal,id(1)]);
 else if(table==='ops_daily_requests')await db.query(`UPDATE ${table} SET lifecycle='cancelled'`);
 else if(table==='ops_assignments')await db.query(`UPDATE ${table} SET removed_at=now()`);
 else if(table==='ops_fixed_roster')await db.query(`UPDATE ${table} SET cancelled=true`);
 else await db.query(`UPDATE ${table} SET plan='{"archived":true,"end":"2099-01-01"}'`);
 await db.query('SET LOCAL ROLE authenticated');assert.equal((await preview()).checks.find(c=>c.code===code).blocking,false);
}));
test('unknown and null states stay blocking instead of passing as completed',async()=>{
 for(const status of [null,'future_status'])await run(async()=>{await db.query('INSERT INTO tasks(tenant_id,status) VALUES($1,$2)',[id(1),status]);await claims();await db.query('SET LOCAL ROLE authenticated');assert.equal((await preview()).checks.find(c=>c.code==='unfinished_tasks').blocking,true);});
});
test('dates use Istanbul business day regardless of session timezone',()=>run(async()=>{
 await db.query("SET LOCAL TIME ZONE 'Pacific/Honolulu'");const today=(await db.query("SELECT (statement_timestamp() AT TIME ZONE 'Europe/Istanbul')::date::text d")).rows[0].d;
 await db.query("INSERT INTO ops_daily_requests VALUES($1,'active',$2::date-1)",[id(1),today]);await claims();await db.query('SET LOCAL ROLE authenticated');assert.equal((await preview()).checks.find(c=>c.code==='upcoming_requests').blocking,false);
 await db.query('RESET ROLE');await db.query("UPDATE ops_daily_requests SET work_date=$1",[today]);await db.query('SET LOCAL ROLE authenticated');const v=await preview();assert.equal(v.assessmentDate,today);assert.equal(v.checks.find(c=>c.code==='upcoming_requests').blocking,true);
}));
test('missing relation produces an error, never a green empty report',()=>run(async()=>{
 await db.query('DROP TABLE tasks');await claims();await db.query('SET LOCAL ROLE authenticated');await assert.rejects(preview(),e=>e.code==='42P01');
}));
test('real SQL response satisfies the application parser contract',()=>run(async()=>{
 const {importActualTypeScript}=await import('./helpers/import-typescript.mjs');
 const {parseModuleChangePreview}=await importActualTypeScript(new URL('../src/lib/modules/change-preview.ts',import.meta.url));
 await claims();await db.query('SET LOCAL ROLE authenticated');const value=await preview();
 const result=parseModuleChangePreview(value,{actorId:id(11),tenantId:id(1),membershipVersion:id(31),selectionVersion:null},'1',all(false));
 assert.equal(result.checks.length,16);assert.equal(result.mutationAvailable,false);
}));

test('customer_linked_tasks: dependent open task is visible even when tasks stays enabled',()=>run(async()=>{
 await db.query("INSERT INTO tasks(tenant_id,status,company_id) VALUES($1,'acik',$2)",[id(1),id(99)]);await claims();await db.query('SET LOCAL ROLE authenticated');
 const draft={...all(true),customers:false};
 let v=await preview(draft);assert.equal(v.checks.find(c=>c.code==='customer_linked_tasks').blocking,true);assert.ok(!v.disabled.includes('tasks'));
 await db.query('RESET ROLE');await db.query("UPDATE tasks SET status='tamamlandi'");await db.query('SET LOCAL ROLE authenticated');
 v=await preview(draft);assert.equal(v.checks.find(c=>c.code==='customer_linked_tasks').blocking,false);
}));

test('appointment_linked_tasks: dependent open task is visible even when tasks stays enabled',()=>run(async()=>{
 await db.query("INSERT INTO tasks(tenant_id,status,appointment_id) VALUES($1,'acik',$2)",[id(1),id(99)]);await claims();await db.query('SET LOCAL ROLE authenticated');
 const draft={...all(true),calendar:false};
 let v=await preview(draft);assert.equal(v.checks.find(c=>c.code==='appointment_linked_tasks').blocking,true);assert.ok(!v.disabled.includes('tasks'));
 await db.query('RESET ROLE');await db.query("UPDATE tasks SET status='tamamlandi'");await db.query('SET LOCAL ROLE authenticated');
 v=await preview(draft);assert.equal(v.checks.find(c=>c.code==='appointment_linked_tasks').blocking,false);
}));

test('contract_linked_tasks: dependent open task is visible even when tasks stays enabled',()=>run(async()=>{
 await db.query("INSERT INTO tasks(tenant_id,status,contract_id) VALUES($1,'acik',$2)",[id(1),id(99)]);await claims();await db.query('SET LOCAL ROLE authenticated');
 const draft={...all(true),contracts:false};
 let v=await preview(draft);assert.equal(v.checks.find(c=>c.code==='contract_linked_tasks').blocking,true);assert.ok(!v.disabled.includes('tasks'));
 await db.query('RESET ROLE');await db.query("UPDATE tasks SET status='tamamlandi'");await db.query('SET LOCAL ROLE authenticated');
 v=await preview(draft);assert.equal(v.checks.find(c=>c.code==='contract_linked_tasks').blocking,false);
}));

test('unfinished file uploads or cancellation cleanup block talent closure until ready or cleaned',()=>run(async()=>{
 await claims();const check=async()=> (await preview()).checks.find(c=>c.code==='pending_talent_files').blocking;
 await db.query(`INSERT INTO talent_attachments VALUES('${id(2)}',false,false)`);assert.equal(await check(),false);
 await db.query(`INSERT INTO talent_attachments VALUES('${id(1)}',false,false)`);assert.equal(await check(),true);
 await db.query(`UPDATE talent_attachments SET cleaned=true WHERE tenant_id='${id(1)}'`);assert.equal(await check(),false);
 await db.query(`UPDATE talent_attachments SET cleaned=false,ready=true WHERE tenant_id='${id(1)}'`);assert.equal(await check(),false);
}));
