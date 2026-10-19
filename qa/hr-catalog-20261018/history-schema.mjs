// Synthetic local clone only; never connects to production.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
const {importActualTypeScript}=await import('../../scripts/helpers/import-typescript.mjs');
const {parseVersionedModuleHistory}=await importActualTypeScript(new URL('../../src/lib/modules/change-history.ts',import.meta.url));
const server='supabase_db_bps-supabase-acceptance',db=`bps_history_versions_${process.pid}`;
const migration='20261019000100_module_history_catalog_versions.sql';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const call=(version,actor=11,tenant=1)=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='{"sub":"${id(actor)}","active_tenant_id":"${id(1)}"}';SET LOCAL ROLE authenticated;SELECT public.workspace_module_history_v${version}('${id(actor)}','${id(tenant)}');COMMIT;`).split('\n').at(-1));
const checks=[];let created=false;
try {
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');created=true;
 for(const f of loadFixtureMigrations().filter(f=>f!==migration))sql(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const initial=call(1).context;
 sql('GRANT EXECUTE ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated');
 const desired={...initial.modules,finance:!initial.modules.finance};
 const change=()=>JSON.parse(sql(`BEGIN;SET LOCAL request.jwt.claims='{"sub":"${id(11)}","active_tenant_id":"${id(1)}"}';SET LOCAL ROLE authenticated;SELECT change_workspace_modules_v1('${id(11)}','${id(1)}','${initial.membershipVersion}',${initial.selectionVersion?"'"+initial.selectionVersion+"'":'NULL'},'${initial.configRevision}','${id(9931)}','${JSON.stringify(desired)}');COMMIT;`).split('\n').at(-1));
 const changed=change();
 const before=call(1);
 const receipts=sql('SELECT jsonb_agg(to_jsonb(c) ORDER BY tenant_id,after_revision) FROM tenant_module_changes c');
 sql(readFileSync(new URL('../../supabase/migrations/'+migration,import.meta.url),'utf8'));
 assert.deepEqual(call(1),before);
 assert.deepEqual(change(),{...changed,replayed:true});
 assert.equal(sql("SELECT jsonb_agg(to_jsonb(c)-'before_catalog_version'-'after_catalog_version' ORDER BY tenant_id,after_revision) FROM tenant_module_changes c"),receipts);
 checks.push('Existing v1 response, states, revisions, command receipts and hashes unchanged');
 const v2=call(2);assert.equal(v2.historySchemaVersion,2);assert.deepEqual(v2.context,before.context);
 assert.deepEqual(v2.entries.map(({beforeCatalogVersion,afterCatalogVersion,...row})=>{assert.equal(beforeCatalogVersion,1);assert.equal(afterCatalogVersion,1);return row;}),before.entries);
 assert.equal(parseVersionedModuleHistory(v2,v2.context).length,before.entries.length);
 checks.push('v2 reader returns complete versioned history accepted by actual application parser');
 assert.throws(()=>call(2,11,2),e=>String(e.stderr).includes('WORKSPACE_SCOPE'));
 sql(`UPDATE tenant_memberships SET role='operasyon' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';UPDATE profiles SET role='operasyon' WHERE id='${id(11)}'`);
 assert.throws(()=>call(2),e=>String(e.stderr).includes('WORKSPACE_SCOPE'));
 sql(`UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';UPDATE profiles SET role='yonetici' WHERE id='${id(11)}'`);
 assert.equal(sql("SELECT has_function_privilege('anon','public.workspace_module_history_v2(uuid,uuid)','EXECUTE')"),'f');
 assert.equal(sql("SELECT has_table_privilege('authenticated','public.tenant_module_changes','UPDATE')"),'f');
 checks.push('Cross-tenant and non-manager access denied; anonymous execute and direct writes remain denied');
 assert.throws(()=>sql('UPDATE tenant_module_changes SET after_catalog_version=2'),e=>String(e.stderr).includes('module_history_after_catalog_known'));
 assert.throws(()=>sql('UPDATE tenant_module_changes SET before_catalog_version=2'),e=>String(e.stderr).includes('module_history_before_catalog_known'));
 checks.push('Unknown snapshot catalog versions cannot be stored before the next reviewed migration');
 // Exercise the existing bootstrap writer without adding a real tenant.
 sql(`BEGIN;DELETE FROM tenant_module_config WHERE tenant_id='${id(2)}';SELECT tenant_module_bootstrap_v1('${id(2)}');DO $$ BEGIN IF NOT EXISTS(SELECT FROM tenant_module_changes WHERE tenant_id='${id(2)}' AND before_catalog_version=1 AND after_catalog_version=1) THEN RAISE EXCEPTION 'bootstrap versions missing';END IF;END $$;ROLLBACK;`);
 checks.push('Existing bootstrap writer supplies valid version metadata through defaults');
 writeFileSync(new URL('./history-schema-result.json',import.meta.url),JSON.stringify({baseSource:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),measuredAt:new Date().toISOString(),migration,checks,limits:['Synthetic local PostgreSQL clone, not production preflight','Catalog remains v1; no HR activation or v2 write command','New reader not yet connected to UI; no HTTP/browser acceptance'],deployed:false},null,2)+'\n');
 console.log(`PASS ${checks.length} actual-schema history groups`);
} finally {if(created)sql(`DROP DATABASE ${db} WITH(FORCE)`,'postgres');}
