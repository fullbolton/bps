import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {parseHrDirectory}=await importActualTypeScript(new URL('../../src/lib/services/hr-directory.ts',import.meta.url));
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_directory_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const auth=q=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='{"sub":"${id(11)}","active_tenant_id":"${id(1)}"}';SET LOCAL ROLE authenticated;SELECT ${q};COMMIT;`).split('\n').at(-1));
const create=(n,payload)=>auth(`hr_create_record_v1('${id(11)}','${id(1)}','${id(n)}','${JSON.stringify(payload).replaceAll("'","''")}')`);
const read=after=>auth(`hr_directory_v1('${id(11)}','${id(1)}',${after?"'"+after+"'":'NULL'})`);
let created=false;const checks=[];
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 assert.throws(()=>read(),e=>String(e.stderr).includes('HR_MODULE_CLOSED'));
 // Test-only activation: production key guard remains unchanged in source and production.
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 assert.throws(()=>auth(`hr_directory_v1('${id(12)}','${id(1)}',NULL)`),e=>String(e.stderr).includes('HR_SCOPE'));
 assert.throws(()=>auth(`hr_directory_v1('${id(11)}','${id(2)}',NULL)`),e=>String(e.stderr).includes('HR_SCOPE'));
 checks.push('Closed module, actor spoof and foreign company are denied');
 for(const role of ['operasyon','muhasebe','goruntuleyici']){
  assert.throws(()=>sql(`BEGIN;UPDATE tenant_memberships SET role='${role}' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';SET LOCAL request.jwt.claims='{"sub":"${id(11)}","active_tenant_id":"${id(1)}"}';SET LOCAL ROLE authenticated;SELECT hr_directory_v1('${id(11)}','${id(1)}',NULL);ROLLBACK;`),e=>String(e.stderr).includes('HR_FORBIDDEN'));
 }
 sql(`BEGIN;UPDATE tenant_memberships SET role='ik' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';SET LOCAL request.jwt.claims='{"sub":"${id(11)}","active_tenant_id":"${id(1)}"}';SET LOCAL ROLE authenticated;SELECT hr_create_record_v1('${id(11)}','${id(1)}','${id(9790)}','{"kind":"department","name":"IK role acceptance"}');ROLLBACK;`);
 checks.push('Operations/accounting/viewer denied; HR role can create within company');
 const department=create(9701,{kind:'department',name:'Synthetic HR'});
 assert.deepEqual(create(9701,{kind:'department',name:'Synthetic HR'}),department);
 const payload={kind:'employee',name:'Synthetic Employee',code:'HR-001',startsOn:'2026-01-01',departmentId:department.id,position:'Synthetic role'};
 const receipt=create(9702,payload);assert.deepEqual(create(9702,payload),receipt);
 assert.throws(()=>create(9702,{...payload,code:'changed'}),e=>String(e.stderr).includes('HR_COMMAND_REUSED'));
 assert.throws(()=>create(9703,payload),e=>String(e.stderr).includes('duplicate key'));
 assert.equal(sql('SELECT count(*) FROM hr_people'),'1');assert.equal(sql('SELECT count(*) FROM hr_employees'),'1');
 const data=parseHrDirectory(read(),id(11),id(1));assert.equal(data.employees[0].name,payload.name);assert.equal(data.employees[0].department,'Synthetic HR');assert.equal(data.hasMore,false);
 checks.push('Atomic employee/person/period/assignment; exact replay and conflict protection; actual SQL response passes client parser');
 assert.throws(()=>create(9704,{...payload,code:'HR-002',departmentId:id(9999)}));
 assert.equal(sql('SELECT count(*) FROM hr_people'),'1');
 assert.throws(()=>create(9705,{...payload,code:'HR-002',startsOn:'2026-02-30'}));
 assert.throws(()=>create(9706,{kind:'department',name:'Bad',unexpected:true}),e=>String(e.stderr).includes('HR_INPUT'));
 checks.push('Invalid department/date/extra payload rollback completely without orphan identity');
 for(let n=0;n<51;n++)create(9800+n,{kind:'employee',name:'Synthetic '+n,code:'PAGE-'+n,startsOn:'2026-01-01'});
 const first=parseHrDirectory(read(),id(11),id(1));assert.equal(first.employees.length,50);assert.equal(first.hasMore,true);
 const second=parseHrDirectory(read(first.employees.at(-1).id),id(11),id(1));assert.equal(second.employees.length,2);assert.equal(second.hasMore,false);
 assert.equal(new Set([...first.employees,...second.employees].map(e=>e.id)).size,52);
 checks.push('Keyset pagination returns all 52 rows across bounded non-overlapping pages');
 sql(`UPDATE tenant_module_entitlements SET granted=false WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 assert.throws(()=>read(),e=>String(e.stderr).includes('HR_MODULE_CLOSED'));
 assert.throws(()=>create(9702,payload),e=>String(e.stderr).includes('HR_MODULE_CLOSED'));
 assert.equal(sql("SELECT has_table_privilege('authenticated','hr_commands','SELECT,INSERT,UPDATE,DELETE')"),'f');
 checks.push('Revoked entitlement blocks reads and retries; command payloads remain private');
 writeFileSync(new URL('./directory-schema-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),checks,deployed:false},null,2)+'\n');console.log(`PASS ${checks.length} HR directory groups`);
}finally{if(created)sql(`DROP DATABASE ${db} WITH(FORCE)`,'postgres');}
