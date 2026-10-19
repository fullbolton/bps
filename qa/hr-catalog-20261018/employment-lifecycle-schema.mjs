import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_lifecycle_${process.pid}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let created=false;const checks=[];
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const auth=q=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='${JSON.stringify({sub:id(11),active_tenant_id:id(1),workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${id(11)}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`)})}';SET LOCAL ROLE authenticated;SELECT ${q};COMMIT;`).split('\n').at(-1));
 const fails=(fn,msg)=>assert.throws(fn,e=>String(e.stderr).includes(msg));
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 const make=(n,code)=>auth(`hr_create_record_v1('${id(11)}','${id(1)}','${id(n)}','${JSON.stringify({kind:'employee',name:'Synthetic HR',code,startsOn:'2026-01-01'})}')`).id;

 const employee=make(9801,'LIFE1');
 const review=(e=employee)=>auth(`hr_employment_review_v1('${id(11)}','${id(1)}','${e}')`);
 const change=(c,n,kind='end',date='2026-06-30')=>auth(`hr_employment_change_v1('${id(11)}','${id(1)}','${id(n)}','${c.employeeId}','${c.token}','${kind}','${date}')`);
 const period=review().periodId;
 sql(`INSERT INTO hr_departments(id,tenant_id,name) VALUES('${id(9900)}','${id(1)}','Synthetic department');INSERT INTO hr_work_locations(id,tenant_id,name) VALUES('${id(9901)}','${id(1)}','Synthetic office');INSERT INTO hr_assignments(id,tenant_id,employment_id,employee_id,department_id,position,starts_on) VALUES('${id(9902)}','${id(1)}','${period}','${employee}','${id(9900)}','Test','2026-01-01');INSERT INTO hr_location_assignments(id,tenant_id,employment_id,employee_id,location_id,starts_on) VALUES('${id(9903)}','${id(1)}','${period}','${employee}','${id(9901)}','2026-01-01')`);
 let c=review();
 fails(()=>change(c,9803,'end','2025-12-31'),'HR_EMPLOYMENT_DATE');fails(()=>change(c,9803,'end','2199-01-01'),'HR_EMPLOYMENT_DATE');
 sql(`CREATE FUNCTION public.qa_lifecycle_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_AUDIT_FAILURE';END $$;CREATE TRIGGER qa_lifecycle_fail BEFORE INSERT ON hr_commands FOR EACH ROW EXECUTE FUNCTION public.qa_lifecycle_fail()`);
 fails(()=>change(c,9803),'QA_AUDIT_FAILURE');assert.deepEqual(review(),c);sql('DROP TRIGGER qa_lifecycle_fail ON hr_commands;DROP FUNCTION qa_lifecycle_fail()');checks.push('Invalid dates rejected; audit failure rolls back employment and both assignments');
 const receipt=change(c,9803);assert.deepEqual(change(c,9803),receipt);fails(()=>change(c,9803,'end','2026-06-29'),'HR_COMMAND_REUSED');fails(()=>change(c,9804),'HR_EMPLOYMENT_STALE');
 let closed=review();assert.equal(closed.endsOn,'2026-06-30');assert.equal(closed.assignments[0].endsOn,'2026-06-30');assert.equal(closed.locations[0].endsOn,'2026-06-30');assert.equal(closed.locations[0].revision,'2');checks.push('End closes both assignments atomically; retry does not duplicate; changed command and stale review rejected');
 fails(()=>change(closed,9805,'rehire','2026-06-30'),'HR_EMPLOYMENT_DATE');const rehired=change(closed,9805,'rehire','2026-07-01');assert.notEqual(rehired.periodId,period);assert.deepEqual(change(closed,9805,'rehire','2026-07-01'),rehired);assert.equal(review().assignments.length,0);assert.equal(review().locations.length,0);assert.equal(sql(`SELECT count(*) FROM hr_employment_periods WHERE employee_id='${employee}'`),'2');checks.push('Rehire preserves old period, rejects overlap, creates one empty new period without copying assignments');
 sql(`INSERT INTO hr_account_links(id,tenant_id,employee_id,account_id,membership_id) VALUES('${id(9910)}','${id(1)}','${employee}','${id(11)}','${id(1)}')`);
 c=review();fails(()=>change(c,9806,'end','2026-07-31'),'HR_ACCOUNT_LINK_ACTIVE');sql(`UPDATE hr_account_links SET unlinked_at=statement_timestamp(),revision=revision+1 WHERE id='${id(9910)}'`);fails(()=>change(c,9806,'end','2026-07-31'),'HR_EMPLOYMENT_STALE');checks.push('Active account link blocks termination and link changes invalidate review');
 const child=make(9810,'CHILD'),childPeriod=review(child).periodId;
 sql(`INSERT INTO hr_assignments(id,tenant_id,employment_id,employee_id,department_id,position,manager_employment_id,starts_on) VALUES('${id(9911)}','${id(1)}','${childPeriod}','${child}','${id(9900)}','Test','${rehired.periodId}','2026-07-01')`);
 c=review();fails(()=>change(c,9811,'end','2026-07-31'),'HR_MANAGER_HAS_REPORTS');sql(`UPDATE hr_assignments SET ends_on='2026-07-31',revision=revision+1 WHERE id='${id(9911)}'`);
 sql(`INSERT INTO hr_location_assignments(id,tenant_id,employee_id,employment_id,location_id,starts_on) VALUES('${id(9912)}','${id(1)}','${employee}','${rehired.periodId}','${id(9901)}','2026-08-01')`);c=review();fails(()=>change(c,9812,'end','2026-07-31'),'HR_FUTURE_ASSIGNMENTS');checks.push('Manager reports and future workplace assignment prevent history-breaking termination');
 fails(()=>auth(`hr_employment_review_v1('${id(11)}','${id(2)}','${employee}')`),'HR_SCOPE');
 assert.equal(sql("SELECT has_function_privilege('anon','hr_employment_change_v1(uuid,uuid,uuid,uuid,text,text,date)','EXECUTE')"),'f');
 sql(`UPDATE tenant_memberships SET role='ik' WHERE tenant_id='${id(1)}' AND user_id='${id(11)}'`);fails(review,'HR_MANAGER_REQUIRED');sql(`UPDATE tenant_memberships SET role='yonetici' WHERE tenant_id='${id(1)}' AND user_id='${id(11)}'`);
 sql(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='hr'`);fails(()=>change(closed,9805,'rehire','2026-07-01'),'HR_MODULE_CLOSED');checks.push('Cross-company, non-manager, anonymous and closed-module replay denied');
 writeFileSync(new URL('./employment-lifecycle-schema-result.json',import.meta.url),JSON.stringify({checks,passed:checks.length,syntheticOnly:true},null,2)+'\n');console.log('PASS',checks.length,'employment lifecycle groups');
}finally{if(created)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
