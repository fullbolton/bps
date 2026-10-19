import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_documents_${process.pid}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let created=false;const checks=[];
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const auth=q=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='${JSON.stringify({sub:id(11),active_tenant_id:id(1),workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${id(11)}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`)})}';SET LOCAL ROLE authenticated;SELECT ${q};COMMIT;`).split('\n').at(-1));
 const fails=(fn,msg)=>assert.throws(fn,e=>String(e.stderr).includes(msg));
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 const make=(n,code)=>auth(`hr_create_record_v1('${id(11)}','${id(1)}','${id(n)}','${JSON.stringify({kind:'employee',name:'Synthetic HR',code,startsOn:'2026-01-01'})}')`).id;


 const employee=make(9801,'DOCS');const period=sql(`SELECT id FROM hr_employment_periods WHERE employee_id='${employee}'`);
 sql(`INSERT INTO hr_private_documents(id,tenant_id,employee_id,employment_id,title,storage_path,file_size,content_sha256,validity_date,created_by) SELECT gen_random_uuid(),'${id(1)}','${employee}','${period}','Synthetic document '||n,'private-synthetic/'||n,100,repeat('a',64),DATE '2000-01-01','${id(11)}' FROM generate_series(1,51) n`);
 const list=after=>auth(`hr_private_documents_v1('${id(11)}','${id(1)}','${employee}'${after?`, '${after}'`:''})`);
 const first=list();assert.equal(first.documents.length,50);assert.equal(first.hasMore,true);assert.equal(first.documents[0].expired,true);assert.ok(!JSON.stringify(first).includes('storage_path'));assert.ok(!JSON.stringify(first).includes('private-synthetic'));const next=list(first.documents.at(-1).id);assert.equal(next.documents.length,1);assert.equal(next.hasMore,false);checks.push('Bounded stable pagination, computed expiry and no object path disclosure');
 for(const role of ['operasyon','muhasebe']){sql(`UPDATE tenant_memberships SET role='${role}' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`);fails(()=>list(),'HR_FORBIDDEN');}sql(`UPDATE tenant_memberships SET role='ik' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`);assert.equal(list().documents.length,50);checks.push('Legacy HR read allowed; operations and finance roles cannot inherit general document access');
 sql(`INSERT INTO company_hr_access_modes(tenant_id,mode) VALUES('${id(1)}','scoped');INSERT INTO company_access_state VALUES('${id(1)}',1);INSERT INTO company_access_roles(id,tenant_id,name,rules) VALUES('${id(9862)}','${id(1)}','Doc test','[]');INSERT INTO company_access_assignments SELECT tenant_id,user_id,id,'${id(9862)}' FROM tenant_memberships WHERE tenant_id='${id(1)}' AND user_id='${id(11)}'`);
 const rules=caps=>sql(`UPDATE company_access_roles SET rules='${JSON.stringify(caps.map(capability=>({capability,effect:'allow',scope:{kind:'company'}})))}' WHERE id='${id(9862)}'`);
 rules(['hr.employees.read']);fails(()=>list(),'HR_FORBIDDEN');rules(['hr.employees.read','hr.documents.download']);assert.equal(list().documents.length,50);rules(['hr.documents.download']);fails(()=>list(),'HR_FORBIDDEN');checks.push('Scoped mode requires both employee read and private document capability; legacy HR role cannot bypass');

 sql(`INSERT INTO hr_departments(id,tenant_id,name) VALUES('${id(9880)}','${id(1)}','Allowed department'),('${id(9881)}','${id(1)}','Other department');INSERT INTO hr_assignments(id,tenant_id,employment_id,employee_id,department_id,position,starts_on) VALUES('${id(9882)}','${id(1)}','${period}','${employee}','${id(9880)}','Synthetic','2026-01-01')`);
 const scopedRules=department=>[{capability:'hr.employees.read',effect:'allow',scope:{kind:'company'}},{capability:'hr.documents.download',effect:'allow',scope:{kind:'selected',departmentIds:[department],locationIds:[]}}];
 sql(`UPDATE company_access_roles SET rules='${JSON.stringify(scopedRules(id(9881)))}' WHERE id='${id(9862)}'`);fails(()=>list(),'HR_FORBIDDEN');
 sql(`UPDATE company_access_roles SET rules='${JSON.stringify(scopedRules(id(9880)))}' WHERE id='${id(9862)}'`);assert.equal(list().documents.length,50);
 sql(`UPDATE company_access_roles SET rules='${JSON.stringify([...scopedRules(id(9880)),{capability:'hr.documents.download',effect:'deny',scope:{kind:'company'}}])}' WHERE id='${id(9862)}'`);fails(()=>list(),'HR_FORBIDDEN');checks.push('Selected department scope respected and explicit deny overrides matching allow');
 for(const role of ['anon','authenticated','service_role'])assert.equal(sql(`SELECT has_table_privilege('${role}','hr_private_documents','SELECT')`),'f');assert.equal(sql("SELECT has_function_privilege('authenticated','hr_private_document_access_v1(uuid,uuid,uuid,boolean)','EXECUTE')"),'f');checks.push('Direct table access and internal helper execution revoked');
 fails(()=>auth(`hr_private_documents_v1('${id(11)}','${id(2)}','${employee}')`),'HR_SCOPE');sql(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='hr'`);fails(()=>list(),'HR_MODULE_CLOSED');checks.push('Foreign company and closed HR module denied');
 writeFileSync(new URL('./hr-private-documents-result.json',import.meta.url),JSON.stringify({passed:checks.length,checks,syntheticOnly:true,storageUploadEnabled:false},null,2)+'\n');console.log('PASS',checks.length,'HR private document groups');
}finally{if(created)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
