// Requires the documented LOCAL schema snapshot and synthetic tenant seed.
// No production connection, persisted mutation or real file bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const migration=['20261013000300_document_contract_module_access.sql','20261016000600_document_metadata_command.sql','20261015000500_document_cleanup_queue.sql','20261015000600_document_cleanup_retry.sql','20261016000700_document_delete_command.sql'].map(file=>readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')).join('\n');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const claims=`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(1)})}',true);`;
const input=`'${id(11)}','${id(1)}','${id(943)}'`;
function run(sql,database='bps_module_chain_20261005'){return spawnSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:20000});}
const seed=`
${claims}
INSERT INTO companies(id,name,tenant_id) VALUES('${id(941)}','Synthetic document A','${id(1)}'),('${id(942)}','Synthetic document B','${id(2)}');
INSERT INTO contracts(id,company_id,name,tenant_id) VALUES('${id(943)}','${id(941)}','Synthetic contract','${id(1)}');
INSERT INTO documents(id,company_id,name,tenant_id) VALUES('${id(944)}','${id(941)}','Synthetic general','${id(1)}'),('${id(945)}','${id(942)}','Synthetic other','${id(2)}');
INSERT INTO storage.buckets(id,name,public) VALUES('documents','documents',false) ON CONFLICT DO NOTHING;
SELECT prepare_contract_document_upload(${input},'${id(946)}',NULL,NULL,'synthetic.pdf',10,repeat('a',64),false,'main',NULL);
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata)
 SELECT 'documents',storage_path,'${id(11)}','{"mimetype":"application/pdf","size":10}'::jsonb FROM contract_pdf_upload_commands WHERE command_id='${id(946)}';
SELECT finish_contract_pdf_upload(${input},'${id(946)}');
`;
function check(body,prefix=''){const r=run('BEGIN;'+prefix+migration+seed+body+'\nROLLBACK;');assert.equal(r.status,0,r.stderr);}
const must=(condition,message)=>`IF NOT (${condition}) THEN RAISE EXCEPTION '${message}'; END IF;`;
test('linked document metadata preserves contract grouping and manager/module checks',()=>check(`
SET LOCAL ROLE authenticated;
DO $$ DECLARE d public.documents;r jsonb;BEGIN
 SELECT * INTO d FROM public.documents WHERE contract_id='${id(943)}';
 BEGIN PERFORM document_edit_metadata_v1('${id(1)}',d.id,'${id(941)}',d.revision,'category','diger');RAISE EXCEPTION 'LINKED_MOVED';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN PERFORM document_delete_v1('${id(1)}',d.id,'${id(941)}',d.revision);RAISE EXCEPTION 'HISTORY_DELETED';EXCEPTION WHEN foreign_key_violation THEN NULL;END;
 r:=document_edit_metadata_v1('${id(1)}',d.id,'${id(941)}',d.revision,'validity','2027-01-01');
 IF r->>'validity_date'<>'2027-01-01' OR (r->>'revision')::int<>d.revision+1 THEN RAISE EXCEPTION 'VALIDITY_RECEIPT';END IF;
END $$;
RESET ROLE;UPDATE tenant_memberships SET role='operasyon' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';SET LOCAL ROLE authenticated;
DO $$ DECLARE d public.documents;BEGIN SELECT * INTO d FROM public.documents WHERE contract_id='${id(943)}';
 BEGIN PERFORM document_edit_metadata_v1('${id(1)}',d.id,'${id(941)}',d.revision,'validity','2028-01-01');RAISE EXCEPTION 'OPERATION_EDITED';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;
RESET ROLE;UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
DO $$ DECLARE d public.documents;BEGIN SELECT * INTO d FROM public.documents WHERE contract_id='${id(943)}';
 BEGIN PERFORM document_edit_metadata_v1('${id(1)}',d.id,'${id(941)}',d.revision,'validity','2028-01-01');RAISE EXCEPTION 'CLOSED_EDITED';EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
END $$;`));
test('enabled modules preserve contract versions, document rows and Storage object reads',()=>check(`
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ${must(`(SELECT count(*)=2 FROM documents)`,'DOCUMENT_READ')}
 ${must(`(SELECT count(*)=1 FROM contracts)`,'CONTRACT_READ')}
 ${must(`jsonb_array_length(contract_pdf_versions(${input})->'versions')=1`,'VERSIONS')}
 ${must(`(SELECT count(*)=1 FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${id(941)}/%')`,'STORAGE_READ')}
END $$;`));
test('disabled contracts hide linked document, versions, path and upload state; general document remains',()=>check(`
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ${must(`(SELECT count(*)=1 FROM documents)`,'GENERAL_DOCUMENT_PRESERVED')}
 ${must(`(SELECT count(*)=0 FROM contracts)`,'CONTRACT_HIDDEN')}
 ${must(`contract_pdf_versions(${input}) IS NULL`,'VERSIONS_HIDDEN')}
 ${must(`contract_appendices(${input},NULL) IS NULL`,'APPENDICES_HIDDEN')}
 ${must(`contract_document_history(${input},'${id(944)}') IS NULL`,'HISTORY_HIDDEN')}
 ${must(`contract_document_version_path(${input},'${id(944)}','${id(946)}') IS NULL`,'PATH_HIDDEN')}
 ${must(`contract_pdf_version_path('${id(11)}','${id(1)}','${id(946)}') IS NULL`,'LEGACY_PATH_HIDDEN')}
 ${must(`(SELECT count(*)=0 FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${id(941)}/%')`,'STORAGE_HIDDEN')}
 BEGIN PERFORM get_contract_pdf_upload(${input},'${id(946)}');RAISE EXCEPTION 'UPLOAD_VISIBLE'; EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
END $$;`));
test('disabled documents hide general documents too without deleting rows',()=>check(`
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key IN ('contracts','documents');
SET LOCAL ROLE authenticated;
DO $$ BEGIN ${must(`(SELECT count(*)=0 FROM documents)`,'DOCUMENTS_HIDDEN')} END $$;
RESET ROLE;
DO $$ BEGIN ${must(`(SELECT count(*)=3 FROM documents)`,'NO_DELETE')} END $$;`));
test('closed module rejects prepare and publish even for a matching existing command',()=>check(`
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM prepare_contract_document_upload(${input},'${id(947)}',NULL,NULL,'second.pdf',10,repeat('a',64),false,'main',NULL);RAISE EXCEPTION 'PREPARE_ALLOWED'; EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
 BEGIN PERFORM finish_contract_pdf_upload(${input},'${id(946)}');RAISE EXCEPTION 'FINISH_ALLOWED'; EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
END $$;`));
test('Storage fence rejects malformed and foreign paths, and leaves other buckets alone',()=>check(`
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ${must(`NOT document_object_module_read_v1('documents','not-a-uuid/file.pdf')`,'MALFORMED_PATH')}
 ${must(`NOT document_object_module_read_v1('documents','${id(942)}/file.pdf')`,'FOREIGN_PATH')}
 ${must(`document_object_module_read_v1('unrelated','file.pdf')`,'OTHER_BUCKET')}
END $$;`));
test('closing tenant A does not hide tenant B general documents',()=>check(`
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key IN ('contracts','documents');
SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(12),active_tenant_id:id(2)})}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN ${must(`(SELECT count(*)=1 FROM documents WHERE id='${id(945)}')`,'TENANT_B_PRESERVED')} END $$;`));
test('module fences cannot be bypassed by an additional permissive policy',()=>check(`
CREATE POLICY test_extra ON documents FOR SELECT TO authenticated USING(true);
CREATE POLICY test_extra ON storage.objects FOR SELECT TO authenticated USING(true);
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key IN ('contracts','documents');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 ${must(`(SELECT count(*)=0 FROM documents)`,'POLICY_OR_BYPASS')}
 ${must(`(SELECT count(*)=0 FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${id(941)}/%')`,'STORAGE_OR_BYPASS')}
END $$;`));
test('modified historical function aborts the migration',()=>{
 const tamper=`CREATE OR REPLACE FUNCTION public.contract_pdf_version_path(p_actor_id uuid,p_tenant_id uuid,p_version_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT NULL::text $$;`;
 const r=run('BEGIN;'+tamper+migration+'ROLLBACK;');assert.notEqual(r.status,0);assert.match(r.stderr,/DOCUMENT_MODULE_BODY_DRIFT/);
});
test('RLS-disabled table aborts the migration',()=>{
 const r=run('BEGIN;ALTER TABLE documents DISABLE ROW LEVEL SECURITY;'+migration+'ROLLBACK;');assert.notEqual(r.status,0);assert.match(r.stderr,/DOCUMENT_MODULE_RLS_REQUIRED/);
});
test('pending upload bytes are also hidden when contracts close',()=>check(`
SELECT prepare_contract_document_upload(${input},'${id(947)}',NULL,NULL,'appendix.pdf',10,repeat('b',64),false,'appendix','Synthetic appendix');
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata)
 SELECT 'documents',storage_path,'${id(11)}','{"mimetype":"application/pdf","size":10}'::jsonb FROM contract_pdf_upload_commands WHERE command_id='${id(947)}';
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
SET LOCAL ROLE authenticated;
DO $$ BEGIN ${must(`(SELECT count(*)=0 FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${id(941)}/%')`,'PENDING_OBJECT_HIDDEN')} END $$;`));
test('historical PDF bytes remain hidden after a replacement',()=>check(`
SELECT prepare_contract_document_upload(${input},'${id(947)}',document_id,0,'replacement.pdf',10,repeat('b',64),false,'main',NULL)
 FROM contract_pdf_upload_commands WHERE command_id='${id(946)}';
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata)
 SELECT 'documents',storage_path,'${id(11)}','{"mimetype":"application/pdf","size":10}'::jsonb FROM contract_pdf_upload_commands WHERE command_id='${id(947)}';
SELECT finish_contract_pdf_upload(${input},'${id(947)}');
DO $$ BEGIN ${must(`(SELECT count(*)=2 FROM contract_document_versions WHERE contract_id='${id(943)}')`,'TWO_VERSIONS')} END $$;
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
SET LOCAL ROLE authenticated;
DO $$ BEGIN ${must(`(SELECT count(*)=0 FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${id(941)}/%')`,'OLD_AND_CURRENT_HIDDEN')} END $$;`));
test('actual document and Storage reads work in a read-only transaction',()=>{
 const database=`bps_document_readonly_${process.pid}`;
 const created=spawnSync('docker',['exec','supabase_db_bps-supabase-acceptance','createdb','-U','postgres','-T','bps_module_chain_20261005',database],{encoding:'utf8',timeout:20000});
 assert.equal(created.status,0,created.stderr);
 try{
  const setup=run('BEGIN;'+migration+seed+'COMMIT;',database);assert.equal(setup.status,0,setup.stderr);
  const result=run(`BEGIN READ ONLY;${claims}SET LOCAL ROLE authenticated;
   SELECT count(*) FROM documents;SELECT count(*) FROM contracts;SELECT contract_pdf_versions(${input});
   SELECT count(*) FROM storage.objects WHERE bucket_id='documents';ROLLBACK;`,database);
  assert.equal(result.status,0,result.stderr);
 }finally{
  const dropped=spawnSync('docker',['exec','supabase_db_bps-supabase-acceptance','dropdb','-U','postgres','--force',database],{encoding:'utf8',timeout:20000});assert.equal(dropped.status,0,dropped.stderr);
 }
});
