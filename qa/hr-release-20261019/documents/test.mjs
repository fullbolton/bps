import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadFixtureMigrations} from '../../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_documents_release_${process.pid}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const snapshot=()=>JSON.stringify({public:JSON.parse(sql(readFileSync(new URL('../catalog.sql',import.meta.url),'utf8'))),storage:sql(`SELECT jsonb_build_object('policies',(SELECT jsonb_agg(p ORDER BY policyname) FROM pg_policies p WHERE schemaname='storage'),'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND NOT tgisinternal),'bucket',(SELECT row_to_json(b) FROM storage.buckets b WHERE id='hr-private'))`)});
let made=false;
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');made=true;
 for(const f of loadFixtureMigrations().filter(f=>f.slice(0,14)<='20261019001700'))sql(readFileSync(new URL('../../../supabase/migrations/'+f,import.meta.url),'utf8'));
 sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]); TRUNCATE supabase_migrations.schema_migrations');
 const versions=[...JSON.parse(readFileSync(new URL('../live-ledger.json',import.meta.url))).rows.map(r=>r.version),...JSON.parse(readFileSync(new URL('../remaining/release.json',import.meta.url))).appliedVersions];
 sql('INSERT INTO supabase_migrations.schema_migrations(version) VALUES '+versions.map(v=>`('${v}')`).join(','));
 const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url)));
 const checks=[];
 const preflight=JSON.parse(sql(readFileSync(new URL('./preflight.sql',import.meta.url),'utf8')));
 assert.equal(preflight.versions.length,207);assert.equal(preflight.hr_bucket,null);assert.equal(preflight.hr_enabled,0);
 // Wrong order must fail before any candidate writes.
 assert.throws(()=>sql(readFileSync(new URL(manifest.migrations[1].version+'.sql',import.meta.url),'utf8')));
 assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations'),'207');
 for(const m of manifest.migrations){
  const payload=readFileSync(new URL(m.version+'.sql',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(payload).digest('hex'),m.installSha256,'Installation payload changed');
  const before=snapshot();
  assert.throws(()=>sql(payload.replace('INSERT INTO supabase_migrations.schema_migrations(version,name,statements)', 'SELECT 1/0; INSERT INTO supabase_migrations.schema_migrations(version,name,statements)')));
  assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations'),String(m.expectedBefore));
  assert.equal(snapshot(),before,'Failed install must restore public and Storage catalog');
  sql(payload);assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations'),String(m.expectedAfter));
  assert.throws(()=>sql(payload));checks.push({version:m.version,rollback:true,catalogRestored:true,retryAfterRollback:true,repeatedInstallRejected:true});
 }
 assert.equal(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (c.relname LIKE 'hr_%' OR c.relname LIKE 'company_access_%') AND NOT c.relrowsecurity"),'0','All HR/access tables require RLS');
 assert.equal(sql('SELECT count(*) FROM hr_access_release_gates WHERE approved'),'0');
 assert.equal(sql("SELECT count(*) FROM company_hr_access_modes WHERE mode='scoped'"),'0');
 writeFileSync(new URL('./test-result.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),syntheticOnly:true,checks,finalLedger:216,activationClosed:true},null,2)+'\n');
 console.log('PASS: 9 rollback + install + replay rejection groups; activation closed');
}finally{if(made)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
