import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';

// Fixed local container and known synthetic template; no production connection or dump.
const container='supabase_db_bps-supabase-acceptance';
const source=`bps_restore_source_${process.pid}`,target=`bps_restore_target_${process.pid}`;
const run=(args,input)=>execFileSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:120000,maxBuffer:64*1024*1024});
const sql=(db,text)=>run(['psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],text).trim();
const hash=text=>createHash('sha256').update(text).digest('hex');
const dump=(db,extra=[])=>run(['pg_dump','-U','postgres','-d',db,...extra]);
const normalize=s=>s.split('\n').filter(line=>!line.startsWith('\\restrict ')&&!line.startsWith('\\unrestrict ')).join('\n');
const made=[];const started=Date.now();
try {
 assert.equal(sql('bps_module_chain_20261005',"select count(*)=2 and bool_and(email like '%test%' or email like '%example%') from auth.users"),'t','Unexpected synthetic fixture users');
 sql('postgres',`CREATE DATABASE ${source} TEMPLATE bps_module_chain_20261005;`);made.push(source);
 const migrations=loadFixtureMigrations();
 for(const name of migrations)sql(source,readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 // Full local database dump includes ACLs, owners and synthetic rows, not external Storage bytes.
 const archive=dump(source);
 sql('postgres',`CREATE DATABASE ${target} TEMPLATE template0;`);made.push(target);
 run(['sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -w -XqAt -U supabase_admin -d "$1" -v ON_ERROR_STOP=1','restore',target],archive);
 const sourceSchema=normalize(dump(source,['--schema-only']));
 const restoredSchema=normalize(dump(target,['--schema-only']));
 assert.equal(hash(restoredSchema),hash(sourceSchema),'Restored schema/ACL definitions differ');
 const tables=JSON.parse(sql(source,"select json_agg(format('%I.%I',schemaname,tablename) order by schemaname,tablename) from pg_tables where schemaname in ('public','auth','storage')"));
 const counts=[];
 for(const table of tables){
  const query=`select count(*)::text || ':' || md5(coalesce(string_agg(row_to_json(r)::text,E'\\n' order by row_to_json(r)::text),'')) from ${table} r`;
  const before=sql(source,query),after=sql(target,query);assert.equal(after,before,`Row mismatch: ${table}`);counts.push({table,rows:Number(before.split(':')[0])});
 }
 // Sequence state is data, not schema: compare both fields before consuming a value.
 const sequences=JSON.parse(sql(source,"select coalesce(json_agg(json_build_object('name',format('%I.%I',schemaname,sequencename),'literal',format('%L',format('%I.%I',schemaname,sequencename))) order by schemaname,sequencename),'[]') from pg_sequences where schemaname in ('public','auth','storage')"));
 assert.ok(sequences.length>0,'No sequences inspected');
 const sequenceChecks=[];
 for(const sequence of sequences){
  const query=`select last_value::text || ':' || is_called::text from ${sequence.name}`;
  const before=sql(source,query),after=sql(target,query);
  assert.equal(after,before,`Sequence state mismatch: ${sequence.name}`);
  const nextQuery=`select nextval(${sequence.literal}::regclass)`;
  const next=sql(source,nextQuery);
  assert.equal(sql(target,nextQuery),next,`Next sequence value mismatch: ${sequence.name}`);
  sequenceChecks.push({name:sequence.name,state:before,nextValue:next});
 }
 assert.equal(sql(target,"set role anon; select has_function_privilege(current_user,'public.workspace_inbox_page_v1(uuid,uuid,text,uuid)','EXECUTE')"),'f');
 assert.equal(sql(target,"set role authenticated; select has_function_privilege(current_user,'public.workspace_inbox_page_v1(uuid,uuid,text,uuid)','EXECUTE')"),'t');
 const report={syntheticOnly:true,sourceTemplate:'bps_module_chain_20261005',postBaselineMigrations:migrations.length,migrationHashes:migrations.map(name=>({name,sha256:hash(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'))})),schemaSha256:hash(sourceSchema),dumpBytes:Buffer.byteLength(archive),tables:counts,sequences:sequenceChecks,checks:['empty template0 restore','schema including owners and ACLs identical','all public/auth/storage row counts and row-content hashes identical','all public/auth/storage sequence states and next values identical','anonymous inbox execution denied','authenticated inbox execution retained'],elapsedMs:Date.now()-started,limits:['Same local PostgreSQL server roles and extensions; not a fresh Supabase installation','No production data or backup','No external Storage objects or Auth/HTTP/browser acceptance','Historical baseline is not reconstructed from repository migrations']};
 writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(`PASS: ${counts.length} tables, ${sequenceChecks.length} sequences, ${migrations.length} migrations; schema, data and RPC ACLs preserved`);
} finally {for(const db of made.reverse())sql('postgres',`DROP DATABASE ${db} WITH (FORCE);`);}
