import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {loadFixtureMigrations} from '../../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_bridge_install_${process.pid}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
let made=false;
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');made=true;
 for(const f of loadFixtureMigrations().filter(f=>f.slice(0,14)<='20261018000600'))sql(readFileSync(new URL('../../../supabase/migrations/'+f,import.meta.url),'utf8'));
 sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]); TRUNCATE supabase_migrations.schema_migrations');
 const versions=JSON.parse(readFileSync(new URL('../pre-release-ledger.json',import.meta.url))).rows.map(r=>r.version);
 sql('INSERT INTO supabase_migrations.schema_migrations(version) VALUES '+versions.map(v=>`('${v}')`).join(','));
 const payload=readFileSync(new URL('./install.sql',import.meta.url),'utf8');
 // Inject a ledger failure: DDL must roll back too.
 assert.throws(()=>sql(payload.replace('INSERT INTO supabase_migrations.schema_migrations(version,name,statements)',"SELECT 1/0; INSERT INTO supabase_migrations.schema_migrations(version,name,statements)")));
 assert.equal(sql("SELECT to_regprocedure('public.workspace_module_history_v2(uuid,uuid)') IS NULL"),'t');
 sql(payload);
 assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations'),'191');
 assert.equal(sql("SELECT to_regprocedure('public.workspace_module_history_v2(uuid,uuid)') IS NOT NULL"),'t');
 assert.throws(()=>sql(payload));
 writeFileSync(new URL('./install-test-result.json',import.meta.url),JSON.stringify({checks:['DDL rolls back on ledger failure','Install adds exactly one ledger version and v2 reader','Repeat stops on ledger mismatch'],syntheticOnly:true,passed:3},null,2)+'\n');
 console.log('PASS 3 atomic installation checks');
}finally{if(made)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
