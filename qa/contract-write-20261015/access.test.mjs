// Real local schema snapshot, synthetic seed, rollback after every case.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const migration=['20261015000100_contract_write_commands.sql','20261015000200_contract_write_cutover.sql','20261015000300_contract_delete_command.sql','20261015000400_contract_delete_cutover.sql'].map(f=>readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'')).join('\n');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const seed=`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(1)})}',true);
INSERT INTO companies(id,name,tenant_id) VALUES('${id(951)}','Synthetic contract A','${id(1)}'),('${id(952)}','Synthetic contract B','${id(2)}');`;
const payload=JSON.stringify({company_id:id(951),name:'Synthetic agreement'});
const create=`contract_write_v1(NULL,'${id(1)}',NULL,'${payload}')`;
function check(body){const r=spawnSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-d','bps_module_chain_20261005','-v','ON_ERROR_STOP=1'],{input:'BEGIN;'+migration+seed+body+'ROLLBACK;',encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr);}
test('manager creates authoritative tenant/author and updates revision with preserved untouched fields',()=>check(`SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts; BEGIN
 SELECT * INTO r FROM ${create};
 IF r.created_by<>'${id(11)}' OR r.status<>'taslak' OR r.revision<>0 THEN RAISE EXCEPTION 'CREATE';END IF;
 SELECT * INTO r FROM contract_write_v1(r.id,r.tenant_id,0,'{"name":"Updated"}');
 IF r.revision<>1 OR r.name<>'Updated' OR r.company_id<>'${id(951)}' THEN RAISE EXCEPTION 'UPDATE';END IF;
END $$;`));
test('stale revision cannot overwrite newer changes',()=>check(`SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts; BEGIN
 SELECT * INTO r FROM ${create};PERFORM contract_write_v1(r.id,r.tenant_id,0,'{"name":"First edit"}');
 BEGIN PERFORM contract_write_v1(r.id,r.tenant_id,0,'{"name":"Stale edit"}');RAISE EXCEPTION 'STALE_ACCEPTED';EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
 IF (SELECT name FROM contracts WHERE id=r.id)<>'First edit' THEN RAISE EXCEPTION 'OVERWRITTEN';END IF;
END $$;`));
test('cross-tenant company and forged tenant are rejected',()=>check(`SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM contract_write_v1(NULL,'${id(1)}',NULL,'{"company_id":"${id(952)}","name":"Foreign"}');RAISE EXCEPTION 'FOREIGN_COMPANY';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM contract_write_v1(NULL,'${id(2)}',NULL,'${payload}');RAISE EXCEPTION 'FORGED_TENANT';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;`));
test('disabled module blocks both creation and editing',()=>check(`CREATE TEMP TABLE target AS SELECT * FROM ${create};
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
GRANT SELECT ON target TO authenticated;SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts; BEGIN
 BEGIN PERFORM ${create};RAISE EXCEPTION 'CREATE_ALLOWED';EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
 SELECT * INTO r FROM target;
 BEGIN PERFORM contract_write_v1(r.id,r.tenant_id,0,'{"name":"Closed"}');RAISE EXCEPTION 'UPDATE_ALLOWED';EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
END $$;`));
test('invalid names, dates, null flags and array coercion are rejected',()=>check(`SET LOCAL ROLE authenticated;
DO $$ DECLARE input jsonb; BEGIN
 FOR input IN SELECT value FROM jsonb_array_elements('[{"name":" "},{"start_date":"2026-10-20","end_date":"2026-10-01"},{"status":"aktif"},{"critical_clauses":[42]},{"renewal_discussion_opened":null}]') LOOP
  BEGIN PERFORM contract_write_v1(NULL,'${id(1)}',NULL,'${payload}'::jsonb||input);RAISE EXCEPTION 'INVALID_ACCEPTED';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 END LOOP;
END $$;`));
test('protected fields and company moves cannot be supplied',()=>check(`SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts; BEGIN
 BEGIN PERFORM contract_write_v1(NULL,'${id(1)}',NULL,'${payload}'::jsonb||'{"created_by":"${id(12)}"}');RAISE EXCEPTION 'FORGED_AUTHOR';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 SELECT * INTO r FROM ${create};
 BEGIN PERFORM contract_write_v1(r.id,r.tenant_id,0,'{"company_id":"${id(952)}"}');RAISE EXCEPTION 'MOVED';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
 BEGIN PERFORM contract_write_v1(r.id,r.tenant_id,0,'{"renewal_task_created":true}');RAISE EXCEPTION 'TASK_FORGED';EXCEPTION WHEN invalid_parameter_value THEN NULL;END;
END $$;`));
for(const role of ['operasyon','ik','muhasebe','goruntuleyici'])test(role+' cannot create contracts',()=>check(`
UPDATE tenant_memberships SET role='${role}' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';SET LOCAL ROLE authenticated;
DO $$ BEGIN BEGIN PERFORM ${create};RAISE EXCEPTION 'ROLE_BYPASS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;END $$;`));
test('direct API writes and anonymous/service command access are revoked',()=>check(`
DO $$ DECLARE r text; BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_any_column_privilege(r,'contracts','INSERT,UPDATE') THEN RAISE EXCEPTION 'DML_BYPASS';END IF;
 END LOOP;
 IF has_function_privilege('anon','contract_write_v1(uuid,uuid,bigint,jsonb)','EXECUTE') OR has_function_privilege('service_role','contract_write_v1(uuid,uuid,bigint,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'COMMAND_BYPASS';END IF;
END $$;`));
test('delete removes only the matching revision and missing row is not success',()=>check(`SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts;deleted contracts;BEGIN
 SELECT * INTO r FROM ${create};SELECT * INTO deleted FROM contract_delete_v1(r.id,r.tenant_id,0);
 IF deleted.id<>r.id OR EXISTS(SELECT FROM contracts WHERE id=r.id) THEN RAISE EXCEPTION 'DELETE_FAILED';END IF;
 BEGIN PERFORM contract_delete_v1(r.id,r.tenant_id,0);RAISE EXCEPTION 'MISSING_SUCCESS';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;`));
test('stale delete confirmation cannot erase a newer revision',()=>check(`SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts;BEGIN
 SELECT * INTO r FROM ${create};PERFORM contract_write_v1(r.id,r.tenant_id,0,'{"name":"New version"}');
 BEGIN PERFORM contract_delete_v1(r.id,r.tenant_id,0);RAISE EXCEPTION 'STALE_DELETE';EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;END;
 IF NOT EXISTS(SELECT FROM contracts WHERE id=r.id) THEN RAISE EXCEPTION 'LOST_RECORD';END IF;
END $$;`));
test('expiry notification history is retained and deletion rejected',()=>check(`
CREATE TEMP TABLE target AS SELECT * FROM ${create};
INSERT INTO contract_expiry_emails_sent(contract_id,recipient_profile_id) SELECT id,'${id(11)}' FROM target;
GRANT SELECT ON target TO authenticated;SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts;BEGIN
 SELECT * INTO r FROM target;
 BEGIN PERFORM contract_delete_v1(r.id,r.tenant_id,0);RAISE EXCEPTION 'HISTORY_DELETED';EXCEPTION WHEN foreign_key_violation THEN NULL;END;
END $$;
RESET ROLE;DO $$ BEGIN IF (SELECT count(*) FROM contract_expiry_emails_sent WHERE contract_id IN(SELECT id FROM target))<>1 THEN RAISE EXCEPTION 'HISTORY_LOST';END IF;END $$;`));
test('closed contracts module rejects delete',()=>check(`CREATE TEMP TABLE target AS SELECT * FROM ${create};
UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';
GRANT SELECT ON target TO authenticated;SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts;BEGIN SELECT * INTO r FROM target;
 BEGIN PERFORM contract_delete_v1(r.id,r.tenant_id,0);RAISE EXCEPTION 'CLOSED_DELETE';EXCEPTION WHEN SQLSTATE 'BM001' THEN NULL;END;
END $$;`));
test('linked task prevents contract deletion without unlinking the task',()=>check(`
CREATE TEMP TABLE target AS SELECT * FROM ${create};
INSERT INTO tasks(tenant_id,company_id,contract_id,title,created_by) SELECT tenant_id,company_id,id,'Synthetic linked task','${id(11)}' FROM target;
GRANT SELECT ON target TO authenticated;SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts;BEGIN SELECT * INTO r FROM target;
 BEGIN PERFORM contract_delete_v1(r.id,r.tenant_id,0);RAISE EXCEPTION 'LINKED_DELETED';EXCEPTION WHEN foreign_key_violation THEN NULL;END;
END $$;
RESET ROLE;DO $$ BEGIN IF NOT EXISTS(SELECT FROM tasks WHERE contract_id IN(SELECT id FROM target)) THEN RAISE EXCEPTION 'TASK_UNLINKED';END IF;END $$;`));
test('operation role and forged tenant cannot delete',()=>check(`CREATE TEMP TABLE target AS SELECT * FROM ${create};
GRANT SELECT ON target TO authenticated;
UPDATE tenant_memberships SET role='operasyon' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';SET LOCAL ROLE authenticated;
DO $$ DECLARE r contracts;BEGIN SELECT * INTO r FROM target;
 BEGIN PERFORM contract_delete_v1(r.id,r.tenant_id,0);RAISE EXCEPTION 'ROLE_DELETE';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN PERFORM contract_delete_v1(r.id,'${id(2)}',0);RAISE EXCEPTION 'TENANT_DELETE';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END $$;`));
test('API delete/truncate and anonymous/service command execution are revoked',()=>check(`
DO $$ DECLARE r text;BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(r,'contracts','DELETE,TRUNCATE') THEN RAISE EXCEPTION 'DELETE_BYPASS';END IF;
 END LOOP;
 IF has_function_privilege('anon','contract_delete_v1(uuid,uuid,bigint)','EXECUTE') OR has_function_privilege('service_role','contract_delete_v1(uuid,uuid,bigint)','EXECUTE') THEN RAISE EXCEPTION 'COMMAND_BYPASS';END IF;
END $$;`));
