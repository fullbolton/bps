import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_upload_${process.pid}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let created=false;const checks=[];
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations())sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const auth=q=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='${JSON.stringify({sub:id(11),active_tenant_id:id(1),workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${id(11)}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`)})}';SET LOCAL ROLE authenticated;SELECT ${q};COMMIT;`).split('\n').at(-1));
 const fails=(fn,msg)=>assert.throws(fn,e=>String(e.stderr).includes(msg));
 sql(`ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${id(1)}' AND module_key='hr'`);
 const make=(n,code)=>auth(`hr_create_record_v1('${id(11)}','${id(1)}','${id(n)}','${JSON.stringify({kind:'employee',name:'Synthetic HR',code,startsOn:'2026-01-01'})}')`).id;


 const employee=make(9801,'UPLOAD');const period=sql(`SELECT id FROM hr_employment_periods WHERE employee_id='${employee}'`);
 const prepare=(n=9810,title='Synthetic PDF')=>auth(`hr_document_prepare_v1('${id(11)}','${id(1)}','${id(n)}','${employee}','${period}','${title}',10,'${'a'.repeat(64)}')`);
 const pending=()=>auth(`hr_document_pending_v1('${id(11)}','${id(1)}','${employee}')`);
 const cancel=()=>auth(`hr_document_cancel_empty_v1('${id(11)}','${id(1)}','${id(9810)}')`);
 const r=prepare();assert.equal(r.state,'pending');assert.deepEqual(prepare(),r);assert.equal(pending().uploads.length,1);fails(()=>prepare(9810,'Changed'),'HR_COMMAND_REUSED');checks.push('Reservation is idempotent; payload change rejected; owner can list pending');
 assert.equal(cancel().state,'cancelled');assert.equal(cancel().state,'cancelled');assert.equal(prepare().state,'cancelled');assert.equal(pending().uploads.length,0);checks.push('Empty cancel is idempotent and cannot resurrect upload');
 fails(()=>prepare(9811,'12345678901'),'HR_INPUT');fails(()=>auth(`hr_document_prepare_v1('${id(11)}','${id(1)}','${id(9811)}','${employee}','${id(9999)}','Title',10,'${'a'.repeat(64)}')`),'HR_FORBIDDEN');checks.push('Title validation and exact employment binding');
 assert.equal(sql("SELECT count(*) FROM storage.buckets WHERE id='hr-private'"),'0');
 prepare(9813);
 sql(`INSERT INTO storage.buckets(id,name,public) VALUES('hr-private','hr-private',false);INSERT INTO storage.objects(bucket_id,name) VALUES('hr-private','${id(1)}/${id(9813)}.pdf')`);
 fails(()=>auth(`hr_document_cancel_empty_v1('${id(11)}','${id(1)}','${id(9813)}')`),'HR_UPLOAD_CLEANUP_REQUIRED');
 assert.equal(sql(`SELECT state FROM hr_document_uploads WHERE id='${id(9813)}'`),'pending');
 checks.push('Existing synthetic object prevents cancellation and retains pending receipt');
 sql(`INSERT INTO hr_document_uploads(id,tenant_id,employee_id,employment_id,actor_id,title,file_size,content_sha256) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}','${employee}','${period}','${id(11)}','Synthetic page',10,repeat('a',64) FROM generate_series(9900,9998) n`);
 const first=pending();assert.equal(first.uploads.length,50);assert.equal(first.hasMore,true);
 const second=auth(`hr_document_pending_v1('${id(11)}','${id(1)}','${employee}','${first.uploads.at(-1).id}')`);
 assert.equal(second.uploads.length,50);assert.equal(second.hasMore,false);
 assert.equal(new Set([...first.uploads,...second.uploads].map(x=>x.id)).size,100);
 fails(()=>prepare(10001),'HR_UPLOAD_LIMIT');assert.equal(prepare(9813).state,'pending');
 checks.push('100 pending limit with exact replay and lossless two-page listing');
 const preflight=()=>auth(`hr_document_shutdown_preflight_v1('${id(11)}','${id(1)}')`);
 assert.equal(preflight().pendingUploads,100);assert.equal(preflight().blocking,true);
 fails(()=>sql(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='hr'`),'HR_UPLOADS_PENDING');
 fails(()=>sql(`UPDATE tenant_module_entitlements SET granted=false WHERE tenant_id='${id(1)}' AND module_key='hr'`),'HR_UPLOADS_PENDING');
 assert.equal(sql(`SELECT enabled FROM tenant_module_settings WHERE tenant_id='${id(1)}' AND module_key='hr'`),'t');
 checks.push('Shutdown preflight counts pending; disabling module or entitlement is rejected');
 sql(`UPDATE tenant_memberships SET role='ik' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`);fails(()=>prepare(9812),'HR_MANAGER_REQUIRED');fails(pending,'HR_MANAGER_REQUIRED');sql(`UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`);
 // Synthetic fixture only: terminalize reservations to exercise the no-pending branch.
 sql(`UPDATE hr_document_uploads SET state='cancelled' WHERE tenant_id='${id(1)}'`);
 assert.equal(preflight().blocking,false);
 sql(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='hr'`);fails(()=>prepare(),'HR_MODULE_CLOSED');checks.push('Read-only HR role and closed module cannot prepare/list/replay');
 assert.equal(sql("SELECT has_table_privilege('authenticated','hr_document_uploads','SELECT')"),'f');checks.push('Ledger private; Storage remains disabled');
 writeFileSync(new URL('./hr-document-upload-result.json',import.meta.url),JSON.stringify({passed:checks.length,checks,syntheticOnly:true},null,2)+'\n');console.log('PASS',checks.length,'HR upload ledger groups');
}finally{if(created)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
