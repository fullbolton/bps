import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {parseHrDirectory}=await importActualTypeScript(new URL('../../src/lib/services/hr-directory.ts',import.meta.url));
const server='supabase_db_bps-supabase-acceptance',db=`bps_scoped_hr_${process.pid}`;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
// Privileged local call of an intentionally ungranted reader, with real verified actor claims.
const read=after=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='{"sub":"${id(11)}","active_tenant_id":"${id(1)}"}';SELECT hr_scoped_directory_v1('${id(11)}','${id(1)}',${after?`'${after}'`:'NULL'});COMMIT;`).split('\n').at(-1));
const rule=(scope,effect='allow')=>({capability:'hr.employees.read',effect,scope});
const setRules=rules=>sql(`UPDATE company_access_roles SET rules='${JSON.stringify(rules)}' WHERE id='${id(9990)}'`);
let created=false;const checks=[];
try {
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 assert.equal(sql("SELECT has_function_privilege('authenticated','hr_scoped_directory_v1(uuid,uuid,uuid)','EXECUTE')"),'f');
 assert.throws(()=>read(),e=>String(e.stderr).includes('HR_MODULE_CLOSED'));
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 assert.throws(()=>read(),e=>String(e.stderr).includes('HR_CUSTOM_POLICY_REQUIRED'));
 // Synthetic manager policy only to exercise the internal reader; public role writer still prohibits self assignment.
 sql(`INSERT INTO company_access_state VALUES('${id(1)}',1);INSERT INTO company_access_roles(id,tenant_id,name,rules) VALUES('${id(9990)}','${id(1)}','Synthetic scoped reader','[]');INSERT INTO company_access_assignments SELECT tenant_id,user_id,id,'${id(9990)}' FROM tenant_memberships WHERE tenant_id='${id(1)}' AND user_id='${id(11)}';INSERT INTO hr_departments(id,tenant_id,name) VALUES('${id(9991)}','${id(1)}','Hidden Dept'),('${id(9992)}','${id(1)}','Visible Dept')`);
 let batch='BEGIN;';for(let n=1;n<=105;n++)batch+=`INSERT INTO hr_people(id,tenant_id,name) VALUES('${id(20000+n)}','${id(1)}','Synthetic ${n}');INSERT INTO hr_employees(id,tenant_id,person_id,code) VALUES('${id(10000+n)}','${id(1)}','${id(20000+n)}','S${n}');INSERT INTO hr_employment_periods(id,tenant_id,employee_id,starts_on) VALUES('${id(30000+n)}','${id(1)}','${id(10000+n)}','2026-01-01');INSERT INTO hr_assignments(id,tenant_id,employment_id,employee_id,department_id,position,starts_on) VALUES('${id(40000+n)}','${id(1)}','${id(30000+n)}','${id(10000+n)}','${id(n<=50?9991:9992)}','Synthetic','2026-01-01');`;sql(batch+'COMMIT;');
 const selected={kind:'selected',departmentIds:[id(9992)],locationIds:[]};setRules([rule(selected)]);
 const firstRaw=read(),first=parseHrDirectory(firstRaw,id(11),id(1));assert.equal(first.employees.length,50);assert.equal(first.hasMore,true);assert.ok(first.employees.every(e=>e.department==='Visible Dept'));assert.equal(first.employees[0].id,id(10051));assert.equal(firstRaw.policyRevision,1);assert.deepEqual(first.departments,[]);
 const second=parseHrDirectory(read(first.employees.at(-1).id),id(11),id(1));assert.equal(second.employees.length,5);assert.equal(second.hasMore,false);assert.equal(new Set([...first.employees,...second.employees].map(e=>e.id)).size,55);
 checks.push('105 records: 50 excluded before pagination; authorized 55 returned as 50+5 without scope/count/department leakage');
 setRules([rule({kind:'company'}),rule(selected,'deny')]);assert.equal(read().employees.length,50);assert.equal(read().hasMore,false);assert.ok(read().employees.every(e=>e.department==='Hidden Dept'));
 setRules([rule({kind:'company'}),rule({kind:'company'},'deny')]);assert.equal(read().employees.length,0);
 setRules([rule({kind:'selected',departmentIds:[id(9992)],locationIds:[id(9998)]})]);assert.equal(read().employees.length,0);
 checks.push('Explicit deny overrides company grants and missing location never matches selected scope');
 sql(`INSERT INTO hr_account_links(id,tenant_id,employee_id,account_id) VALUES('${id(9993)}','${id(1)}','${id(10060)}','${id(11)}')`);setRules([rule({kind:'self'})]);assert.equal(read().employees[0].id,id(10060));assert.equal(read().employees.length,1);
 sql(`UPDATE hr_account_links SET unlinked_at=statement_timestamp(),revision=2 WHERE id='${id(9993)}'`);assert.equal(read().employees.length,0);
 checks.push('Self scope derives account link server-side; unlink immediately removes visibility');
 setRules([rule({kind:'company'})]);
 const exception={...rule({kind:'company'},'deny'),startsAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),reason:'Synthetic restriction'};
 sql(`INSERT INTO company_access_exceptions(id,tenant_id,account_id,membership_id,rule) SELECT '${id(9994)}',tenant_id,user_id,id,'${JSON.stringify(exception)}' FROM tenant_memberships WHERE tenant_id='${id(1)}' AND user_id='${id(11)}'`);assert.equal(read().employees.length,0);
 sql(`UPDATE company_access_exceptions SET revoked=true WHERE id='${id(9994)}'`);assert.equal(read().employees.length,50);
 sql(`UPDATE tenant_module_entitlements SET granted=false WHERE tenant_id='${id(1)}' AND module_key='hr'`);assert.throws(()=>read(),e=>String(e.stderr).includes('HR_MODULE_CLOSED'));
 checks.push('Active exception/revocation and entitlement removal immediately affect reads; no legacy fallback');
 writeFileSync(new URL('./scoped-directory-schema-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),checks,deployed:false,clientExecuteGranted:false},null,2)+'\n');console.log(`PASS ${checks.length} scoped directory groups`);
} finally {if(created)sql(`DROP DATABASE ${db} WITH(FORCE)`,'postgres');}
