import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const runner=readFileSync(new URL('./storage-http.mjs',import.meta.url),'utf8');
const files=JSON.parse(runner.match(/const migrations=(\[[^;]+\]);/)[1].replaceAll("'",'"'));
const read=f=>readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const patchIndex=files.indexOf('20261016001000_workspace_conflict_http.sql');
assert.ok(patchIndex>=0);
const patch=read(files[patchIndex]),base=files.slice(0,patchIndex).map(read).join('\n');
const filter="proname IN ('admin_manage_membership','select_workspace','preview_workspace_modules_v1') AND pronamespace='public'::regnamespace";
function check(body){const r=spawnSync('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-X','-qAt','-U','postgres','-d','bps_module_chain_20261005','-v','ON_ERROR_STOP=1'],{input:'BEGIN;'+base+body+'ROLLBACK;',encoding:'utf8',timeout:20000});assert.equal(r.status,0,r.stderr);}
test('forward patch preserves owner, ACL, security, volatility and config',()=>check(`
CREATE TEMP TABLE before_patch AS SELECT oid,proowner,proacl,prosecdef,provolatile,proconfig FROM pg_proc WHERE ${filter};
${patch}
DO $$ BEGIN
 IF EXISTS(SELECT FROM before_patch b JOIN pg_proc p USING(oid) WHERE ROW(b.proowner,b.proacl,b.prosecdef,b.provolatile,b.proconfig) IS DISTINCT FROM ROW(p.proowner,p.proacl,p.prosecdef,p.provolatile,p.proconfig)) THEN RAISE EXCEPTION 'ATTRIBUTES_CHANGED';END IF;
 IF EXISTS(SELECT FROM pg_proc WHERE ${filter} AND prosrc LIKE '%40001%') THEN RAISE EXCEPTION 'RETRY_CODE_REMAINS';END IF;
END $$;`));
test('later body drift rolls back earlier replacements in the same patch',()=>check(`
DO $drift$ DECLARE f regprocedure:='public.select_workspace(uuid,uuid,uuid,uuid)'::regprocedure; d text;BEGIN d:=pg_get_functiondef(f);EXECUTE replace(d,'WORKSPACE_AUTH','WORKSPACE_AUTH_DRIFT');END $drift$;
CREATE TEMP TABLE before_patch AS SELECT oid,prosrc FROM pg_proc WHERE ${filter};
DO $verify$ BEGIN
 BEGIN EXECUTE $candidate$${patch}$candidate$;RAISE EXCEPTION 'PATCH_ACCEPTED_DRIFT';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'WORKSPACE_CONFLICT_BODY_DRIFT:%' THEN RAISE;END IF;END;
 IF EXISTS(SELECT FROM before_patch b JOIN pg_proc p USING(oid) WHERE b.prosrc IS DISTINCT FROM p.prosrc) THEN RAISE EXCEPTION 'PARTIAL_PATCH';END IF;
END $verify$;`));
