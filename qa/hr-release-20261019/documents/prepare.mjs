import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=new URL('./',import.meta.url),root=new URL('../../../',import.meta.url);
const result=JSON.parse(readFileSync(new URL('./candidate.json',dir)));
const release=JSON.parse(readFileSync(new URL('../remaining/release.json',dir)));
const versions=[...JSON.parse(readFileSync(new URL('../live-ledger.json',dir))).rows.map(r=>r.version),...release.appliedVersions];
assert.equal(versions.length,207);assert.equal(versions.at(-1),'20261019001700');assert.equal(result.migrations.length,9);assert.equal(result.appliedFilesUnchanged,true);
// Generates local candidates only. Fresh production preflight remains mandatory.
const manifest=[];
for(const m of result.migrations){
 const source=readFileSync(new URL('supabase/migrations/'+m.name,root),'utf8');
 assert.equal(createHash('sha256').update(source).digest('hex'),m.sha256);
 assert.equal((source.match(/^BEGIN;/gm)||[]).length,1);assert.equal((source.match(/^COMMIT;/gm)||[]).length,1);
 assert.ok(!source.includes('$bps_source$'));
 const version=m.name.slice(0,14),name=m.name.slice(15,-4);
 assert.ok(/^\d{14}$/.test(version)&&/^[a-z_][a-z_0-9]*$/.test(name));
 const body=source.replace(/^BEGIN;\s*$/m,'').replace(/^COMMIT;\s*$/m,'');
 const payload=`BEGIN; SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='5s';
LOCK TABLE supabase_migrations.schema_migrations IN EXCLUSIVE MODE;
DO $guard$ BEGIN
IF (SELECT array_agg(version ORDER BY version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM ARRAY[${versions.map(v=>`'${v}'`).join(',')}]::text[] THEN RAISE EXCEPTION 'LIVE_LEDGER_CHANGED'; END IF;
IF to_regnamespace('bps_release_guard') IS NOT NULL THEN RAISE EXCEPTION 'RELEASE_BARRIER_PRESENT'; END IF;
END $guard$;
${body}
INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES('${version}','${name}',ARRAY[$bps_source$${source}$bps_source$]);
COMMIT;\n`;
 writeFileSync(new URL(version+'.sql',dir),payload);
 manifest.push({version,name,sourceSha256:m.sha256,installSha256:createHash('sha256').update(payload).digest('hex'),expectedBefore:versions.length,expectedAfter:versions.length+1});versions.push(version);
}
writeFileSync(new URL('manifest.json',dir),JSON.stringify({baseline:207,final:216,atomicPerMigration:true,migrations:manifest},null,2)+'\n');
console.log('Prepared 9 guarded atomic installation files (not deployed)');
