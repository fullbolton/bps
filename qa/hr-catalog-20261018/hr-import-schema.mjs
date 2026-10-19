import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_import_${process.pid}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let created=false;const checks=[];
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const auth=q=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='${JSON.stringify({sub:id(11),active_tenant_id:id(1),workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${id(11)}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`)})}';SET LOCAL ROLE authenticated;SELECT ${q};COMMIT;`).split('\n').at(-1));
 const fails=(fn,msg)=>assert.throws(fn,e=>String(e.stderr).includes(msg));
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 const make=(n,code)=>auth(`hr_create_record_v1('${id(11)}','${id(1)}','${id(n)}','${JSON.stringify({kind:'employee',name:'Synthetic HR',code,startsOn:'2026-01-01'})}')`).id;

 const employee=make(9801,'EXIST');
 const preview=rows=>auth(`hr_import_preview_v1('${id(11)}','${id(1)}','${JSON.stringify(rows)}')`);
 const row=(n,code,name='',startsOn='')=>({row:n,code,name,startsOn});
 const before=sql('SELECT count(*) FROM hr_commands');
 const result=preview([row(2,'NEW','Synthetic new','2026-02-01'),row(3,'exist'),row(4,'MISSING')]);
 assert.deepEqual(result.rows.map(r=>r.status),['new','same','incomplete']);assert.equal(result.rows[1].existing.employeeId,employee);
 assert.equal(preview([row(2,'EXIST','Changed')]).rows[0].status,'changed');assert.equal(preview([row(2,'EXIST','','2026-02-01')]).rows[0].status,'review');checks.push('New/same/incomplete/changed/date-review classifications; blank cells preserve existing values');
 for(const input of [[row(2,'EXIST'),row(3,'exist')],[row(2,'X'),row(2,'Y')],[row(2,'12345678901')],[row(2,'X','','2026-02-30')],Array.from({length:201},(_,i)=>row(i+1,`X${i}`))])assert.throws(()=>preview(input));checks.push('Duplicate codes/row identity, sensitive number, invalid date and oversized batch rejected');
 sql(`UPDATE hr_employment_periods SET ends_on='2026-06-30',revision=revision+1 WHERE employee_id='${employee}'`);assert.equal(preview([row(2,'EXIST','','2026-07-01')]).rows[0].status,'review');assert.equal(sql('SELECT count(*) FROM hr_commands'),before);assert.equal(sql(`SELECT count(*) FROM hr_employment_periods WHERE employee_id='${employee}'`),'1');checks.push('Former employee is review-only; preview creates no command or new employment period');
 fails(()=>auth(`hr_import_preview_v1('${id(11)}','${id(2)}','[]')`),'HR_SCOPE');sql(`UPDATE tenant_memberships SET role='ik' WHERE tenant_id='${id(1)}' AND user_id='${id(11)}'`);fails(()=>preview([row(2,'EXIST')]),'HR_MANAGER_REQUIRED');assert.equal(sql("SELECT has_function_privilege('anon','hr_import_preview_v1(uuid,uuid,jsonb)','EXECUTE')"),'f');checks.push('Cross-tenant, non-manager and anonymous access denied');
 writeFileSync(new URL('./hr-import-schema-result.json',import.meta.url),JSON.stringify({passed:checks.length,checks,syntheticOnly:true},null,2)+'\n');console.log('PASS',checks.length,'HR import groups');
}finally{if(created)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
