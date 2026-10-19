import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_commit_${process.pid}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let created=false;const checks=[];
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const auth=q=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='${JSON.stringify({sub:id(11),active_tenant_id:id(1),workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${id(11)}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`)})}';SET LOCAL ROLE authenticated;SELECT ${q};COMMIT;`).split('\n').at(-1));
 const fails=(fn,msg)=>assert.throws(fn,e=>String(e.stderr).includes(msg));
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 const make=(n,code)=>auth(`hr_create_record_v1('${id(11)}','${id(1)}','${id(n)}','${JSON.stringify({kind:'employee',name:'Synthetic HR',code,startsOn:'2026-01-01'})}')`).id;


 const employee=make(9801,'EXIST');const rows=[{row:2,code:'NEW',name:'New synthetic',startsOn:'2026-01-01'},{row:3,code:'EXIST',name:'Updated synthetic',startsOn:''}];
 const review=()=>auth(`hr_import_review_v1('${id(11)}','${id(1)}','${JSON.stringify(rows)}')`);
 const commit=(token,n=9802,selected=[2,3])=>auth(`hr_import_commit_v1('${id(11)}','${id(1)}','${id(n)}','${'a'.repeat(64)}','${JSON.stringify(rows)}','${token}','${JSON.stringify(selected)}')`);
 const token=review().token;
 fails(()=>commit(token,9802,[2,2]),'HR_INPUT');fails(()=>commit(token,9802,[99]),'HR_IMPORT_DECISION');assert.equal(sql('SELECT count(*) FROM hr_employees'),'1');checks.push('Duplicate or foreign row selection fails before any mutation');
 sql(`CREATE FUNCTION public.qa_import_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_AUDIT_FAILURE';END $$;CREATE TRIGGER qa_import_fail BEFORE INSERT ON hr_commands FOR EACH ROW EXECUTE FUNCTION public.qa_import_fail()`);
 fails(()=>commit(token),'QA_AUDIT_FAILURE');assert.equal(sql('SELECT count(*) FROM hr_employees'),'1');assert.equal(review().token,token);sql('DROP TRIGGER qa_import_fail ON hr_commands;DROP FUNCTION qa_import_fail()');checks.push('Audit failure rolls back entire batch including created person and name update');
 const receipt=commit(token);assert.deepEqual(receipt.rows.map(r=>r.action),['created','updated']);assert.deepEqual(commit(token),receipt);assert.equal(sql('SELECT count(*) FROM hr_employees'),'2');fails(()=>commit(token,9803),'HR_IMPORT_STALE');fails(()=>commit(token,9802,[2]),'HR_COMMAND_REUSED');checks.push('Atomic create/update, exact retry and stale/reused-command protection');
 assert.equal(sql(`SELECT code FROM hr_employees WHERE id='${employee}'`),'EXIST');assert.equal(sql(`SELECT count(*) FROM hr_employment_periods WHERE employee_id='${employee}'`),'1');assert.equal(sql(`SELECT count(*) FROM hr_commands WHERE payload->>'operation'='hr_import'`),'1');checks.push('Code and employment unchanged on name update; one provenance receipt');
 const fresh=review();fails(()=>commit(fresh.token,9804,[2]),'HR_IMPORT_DECISION');sql(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='hr'`);fails(()=>commit(token),'HR_MODULE_CLOSED');checks.push('Same records cannot be recreated; revoked module blocks receipt replay');
 writeFileSync(new URL('./hr-import-commit-result.json',import.meta.url),JSON.stringify({passed:checks.length,checks,syntheticOnly:true},null,2)+'\n');console.log('PASS',checks.length,'HR import commit groups');
}finally{if(created)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
