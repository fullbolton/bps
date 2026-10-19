import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_finalize_${process.pid}`,id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
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

 const finish=()=>auth(`hr_document_finish_v1('${id(11)}','${id(1)}','${id(9810)}')`);
 const attest=(size=10,sha='a'.repeat(64),version='synthetic-v1')=>sql(`BEGIN;SET LOCAL ROLE service_role;SET LOCAL request.jwt.claims='{"role":"service_role"}';SELECT hr_document_attest_v1('${id(1)}','${id(11)}','${id(9810)}','${id(9820)}','${version}',${size},'${sha}');COMMIT;`);
 prepare();fails(finish,'HR_UPLOAD_NOT_VERIFIED');
 fails(()=>auth(`hr_document_attest_v1('${id(1)}','${id(11)}','${id(9810)}','${id(9820)}','synthetic-v1',10,'${'a'.repeat(64)}')`),'permission denied');
 checks.push('Browser cannot attest; finalize requires trusted verification');
 sql(`INSERT INTO storage.objects(id,bucket_id,name,owner_id,version,metadata) VALUES('${id(9820)}','hr-private','${id(1)}/${id(9810)}.pdf','${id(11)}','synthetic-v1','{"size":10,"mimetype":"application/pdf"}')`);
 fails(()=>attest(9),'HR_UPLOAD_CONTENT');fails(()=>attest(10,'b'.repeat(64)),'HR_UPLOAD_CONTENT');fails(()=>attest(10,'a'.repeat(64),'other-version'),'HR_UPLOAD_OBJECT');
 sql(`UPDATE storage.objects SET owner_id='${id(12)}' WHERE id='${id(9820)}'`);fails(()=>attest(),'HR_UPLOAD_OBJECT');sql(`UPDATE storage.objects SET owner_id='${id(11)}' WHERE id='${id(9820)}'`);
 checks.push('Attestation binds exact reserved digest, size, storage version and owner');
 const readContext=auth(`hr_document_verification_context_v1('${id(11)}','${id(1)}','${id(9810)}')`);assert.equal(readContext.objectId,id(9820));assert.equal(readContext.objectVersion,'synthetic-v1');
 attest();attest();assert.equal(sql('SELECT count(*) FROM hr_document_verifications'),'1');
 fails(()=>sql(`UPDATE storage.objects SET version='replaced' WHERE id='${id(9820)}'`),'HR_VERIFIED_OBJECT_IMMUTABLE');
 checks.push('Attestation replay is singular and verified object cannot be replaced');
 sql(`CREATE FUNCTION public.synthetic_hr_insert_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_INSERT_FAILURE';END $$;CREATE TRIGGER synthetic_hr_insert_failure BEFORE INSERT ON hr_private_documents FOR EACH ROW EXECUTE FUNCTION public.synthetic_hr_insert_failure()`);
 fails(finish,'SYNTHETIC_INSERT_FAILURE');assert.equal(sql(`SELECT state FROM hr_document_uploads WHERE id='${id(9810)}'`),'pending');
 sql('DROP TRIGGER synthetic_hr_insert_failure ON hr_private_documents;DROP FUNCTION public.synthetic_hr_insert_failure()');
 checks.push('Metadata insertion failure leaves pending reservation unchanged');
 const first=finish();assert.equal(first.state,'published');assert.deepEqual(finish(),first);assert.equal(sql('SELECT count(*) FROM hr_private_documents'),'1');assert.equal(pending().uploads.length,0);fails(cancel,'HR_UPLOAD_PUBLISHED');
 checks.push('Atomic publication and exact retry produce one document; published cancel refused');
 sql(`UPDATE tenant_memberships SET role='ik' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}'`);fails(finish,'HR_MANAGER_REQUIRED');
 checks.push('Published replay rechecks current authorization');
 writeFileSync(new URL('./hr-document-finalize-result.json',import.meta.url),JSON.stringify({passed:checks.length,checks,syntheticOnly:true,actualStorageBytesVerified:false},null,2)+'\n');console.log('PASS',checks.length,'HR verified finalize groups');
}finally{if(created)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
