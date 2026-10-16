import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const migration=['20261015000500_document_cleanup_queue.sql','20261015000600_document_cleanup_retry.sql','20261015000700_document_cleanup_module_preview.sql'].map(file=>readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')).join('\n');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const seed=`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(1)})}',true);
INSERT INTO companies(id,name,tenant_id) VALUES('${id(951)}','Synthetic cleanup','${id(1)}');
INSERT INTO documents(id,company_id,tenant_id,name,category,status,storage_path) VALUES('${id(952)}','${id(951)}','${id(1)}','Synthetic','diger','tam','${id(951)}/${id(952)}.pdf');`;
const path=`${id(951)}/${id(952)}.pdf`;
function check(body){const r=spawnSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-d','bps_module_chain_20261005','-v','ON_ERROR_STOP=1'],{input:'BEGIN;'+migration+seed+body+'ROLLBACK;',encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr);}
test('metadata deletion atomically creates a pending job; rollback removes both effects',()=>check(`
DO $$ BEGIN
 BEGIN DELETE FROM documents WHERE id='${id(952)}'; RAISE EXCEPTION 'ROLLBACK_TEST';
 EXCEPTION WHEN raise_exception THEN NULL;END;
 IF EXISTS(SELECT FROM document_cleanup_jobs) OR NOT EXISTS(SELECT FROM documents WHERE id='${id(952)}') THEN RAISE EXCEPTION 'NON_ATOMIC';END IF;
END $$;
DELETE FROM documents WHERE id='${id(952)}';
DO $$ BEGIN IF NOT EXISTS(SELECT FROM document_cleanup_jobs WHERE document_id='${id(952)}' AND tenant_id='${id(1)}' AND storage_path='${path}' AND completed_at IS NULL) THEN RAISE EXCEPTION 'JOB_MISSING';END IF;END $$;`));
test('absent object can be acknowledged idempotently and receipt retained',()=>check(`DELETE FROM documents WHERE id='${id(952)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF NOT document_ack_cleanup_v1('${id(952)}') OR NOT document_ack_cleanup_v1('${id(952)}') THEN RAISE EXCEPTION 'ACK';END IF;
IF NOT EXISTS(SELECT FROM document_cleanup_jobs WHERE document_id='${id(952)}' AND completed_at IS NOT NULL) THEN RAISE EXCEPTION 'RECEIPT';END IF;END $$;`));
test('document without a file does not create a cleanup job',()=>check(`
UPDATE documents SET status='eksik',storage_path=NULL WHERE id='${id(952)}';DELETE FROM documents WHERE id='${id(952)}';
DO $$ BEGIN IF EXISTS(SELECT FROM document_cleanup_jobs WHERE document_id='${id(952)}') THEN RAISE EXCEPTION 'EMPTY_JOB';END IF;END $$;`));
test('a missing job cannot be acknowledged as completed',()=>check(`SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM document_ack_cleanup_v1('${id(952)}');RAISE EXCEPTION 'MISSING_ACK';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;`));
test('existing Storage object prevents acknowledgement',()=>check(`
INSERT INTO storage.buckets(id,name) VALUES('documents','documents') ON CONFLICT DO NOTHING;
INSERT INTO storage.objects(bucket_id,name) VALUES('documents','${path}');DELETE FROM documents WHERE id='${id(952)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF document_ack_cleanup_v1('${id(952)}') THEN RAISE EXCEPTION 'FALSE_ACK';END IF;END $$;`));
test('another document referencing the path prevents acknowledgement',()=>check(`
INSERT INTO documents(company_id,tenant_id,name,category,status,storage_path) VALUES('${id(951)}','${id(1)}','Reference','diger','tam','${path}');DELETE FROM documents WHERE id='${id(952)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF document_ack_cleanup_v1('${id(952)}') THEN RAISE EXCEPTION 'REFERENCE_ACK';END IF;END $$;`));
test('other tenant and operation role cannot see or acknowledge cleanup jobs',()=>check(`
DELETE FROM documents WHERE id='${id(952)}';UPDATE tenant_memberships SET role='operasyon' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT FROM document_cleanup_jobs) THEN RAISE EXCEPTION 'LEAK';END IF;
BEGIN PERFORM document_ack_cleanup_v1('${id(952)}');RAISE EXCEPTION 'ROLE_BYPASS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;
RESET ROLE;UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';
UPDATE document_cleanup_jobs SET tenant_id='${id(2)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF EXISTS(SELECT FROM document_cleanup_jobs) THEN RAISE EXCEPTION 'TENANT_LEAK';END IF;
BEGIN PERFORM document_ack_cleanup_v1('${id(952)}');RAISE EXCEPTION 'TENANT_BYPASS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;`));
test('direct DML and anonymous/service RPC execution remain forbidden',()=>check(`DO $$ DECLARE r text;BEGIN
FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
IF has_table_privilege(r,'document_cleanup_jobs','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'QUEUE_DML';END IF;END LOOP;
IF has_function_privilege('anon','document_ack_cleanup_v1(uuid)','EXECUTE') OR has_function_privilege('service_role','document_ack_cleanup_v1(uuid)','EXECUTE') THEN RAISE EXCEPTION 'ACK_GRANT';END IF;END $$;`));
test('queued paths cannot be reused even after acknowledgement',()=>check(`DELETE FROM documents WHERE id='${id(952)}';SELECT document_ack_cleanup_v1('${id(952)}');
DO $$ BEGIN BEGIN
INSERT INTO documents(company_id,tenant_id,name,category,status,storage_path) VALUES('${id(951)}','${id(1)}','Reuse','diger','tam','${path}');
RAISE EXCEPTION 'REUSE_ALLOWED';EXCEPTION WHEN check_violation THEN NULL;END;END $$;`));
test('retry list and target enforce tenant and do not hide pending work',()=>check(`DELETE FROM documents WHERE id='${id(952)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN
IF (SELECT count(*) FROM document_pending_cleanup_v1('${id(1)}',0))<>1 OR document_cleanup_target_v1('${id(1)}','${id(952)}')<>'${path}' THEN RAISE EXCEPTION 'LIST';END IF;
BEGIN PERFORM document_pending_cleanup_v1('${id(2)}',0);RAISE EXCEPTION 'TENANT_LIST';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
BEGIN PERFORM document_cleanup_target_v1('${id(2)}','${id(952)}');RAISE EXCEPTION 'TENANT_TARGET';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;`));
test('queued referenced file is rejected by the Storage delete fence',()=>check(`
INSERT INTO documents(company_id,tenant_id,name,category,status,storage_path) VALUES('${id(951)}','${id(1)}','Reference','diger','tam','${path}');DELETE FROM documents WHERE id='${id(952)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN IF document_cleanup_delete_allowed_v1('documents','${path}') THEN RAISE EXCEPTION 'REFERENCED_DELETE';END IF;END $$;`));
test('preview reports pending cleanup only for the selected tenant and clears it after acknowledgement',()=>check(`
DELETE FROM documents WHERE id='${id(952)}';SET LOCAL ROLE authenticated;
DO $$ DECLARE c jsonb;p jsonb;BEGIN
 c:=current_workspace_modules_v1();
 p:=preview_workspace_modules_v1('${id(11)}','${id(1)}',c->>'configRevision',(c->'modules')||'{"documents":false,"contracts":false}');
 IF NOT p->'checks' @> '[{"code":"pending_document_cleanup","blocking":true}]'::jsonb THEN RAISE EXCEPTION 'MISSING_BLOCKER';END IF;
 IF p->>'mutationAvailable'<>'false' THEN RAISE EXCEPTION 'MUTATION_OPEN';END IF;
 PERFORM document_ack_cleanup_v1('${id(952)}');
 p:=preview_workspace_modules_v1('${id(11)}','${id(1)}',c->>'configRevision',(c->'modules')||'{"documents":false,"contracts":false}');
 IF NOT p->'checks' @> '[{"code":"pending_document_cleanup","blocking":false}]'::jsonb THEN RAISE EXCEPTION 'STALE_BLOCKER';END IF;
END $$;
RESET ROLE;UPDATE document_cleanup_jobs SET completed_at=NULL,tenant_id='${id(2)}';SET LOCAL ROLE authenticated;
DO $$ DECLARE c jsonb;p jsonb;BEGIN c:=current_workspace_modules_v1();
 p:=preview_workspace_modules_v1('${id(11)}','${id(1)}',c->>'configRevision',(c->'modules')||'{"documents":false,"contracts":false}');
 IF NOT p->'checks' @> '[{"code":"pending_document_cleanup","blocking":false}]'::jsonb THEN RAISE EXCEPTION 'FOREIGN_BLOCKER';END IF;
END $$;`));
