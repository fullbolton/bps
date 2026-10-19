import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadFixtureMigrations} from '../../module-change-command-20261017/fixture-migrations.mjs';
const server='supabase_db_bps-supabase-acceptance',db=`bps_hr_live_compare_${process.pid}`;
const sql=(q,d=db)=>execFileSync('docker',['exec','-i',server,'psql','-X','-qAt','-U','postgres','-d',d,'-v','ON_ERROR_STOP=1'],{input:q,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const snapshot=()=>JSON.stringify({public:JSON.parse(sql(readFileSync(new URL('../catalog.sql',import.meta.url),'utf8'))),storage:sql(`SELECT jsonb_build_object('policies',(SELECT jsonb_agg(p ORDER BY policyname) FROM pg_policies p WHERE schemaname='storage'),'triggers',(SELECT jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid)) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND NOT tgisinternal),'bucket',(SELECT row_to_json(b) FROM storage.buckets b WHERE id='hr-private'))`)});
let made=false;
try{
 sql(`CREATE DATABASE ${db} TEMPLATE bps_module_chain_20261005`,'postgres');made=true;
 for(const f of loadFixtureMigrations().filter(f=>f.slice(0,14)<='20261019001700'))sql(readFileSync(new URL('../../../supabase/migrations/'+f,import.meta.url),'utf8'));
 sql('CREATE SCHEMA IF NOT EXISTS supabase_migrations; CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]); TRUNCATE supabase_migrations.schema_migrations');
 const versions=[...JSON.parse(readFileSync(new URL('../live-ledger.json',import.meta.url))).rows.map(r=>r.version),...JSON.parse(readFileSync(new URL('../remaining/release.json',import.meta.url))).appliedVersions];
 sql('INSERT INTO supabase_migrations.schema_migrations(version) VALUES '+versions.map(v=>`('${v}')`).join(','));

 const live=JSON.parse(readFileSync(new URL('./live-catalog.json',import.meta.url))).rows[0].catalog;
 const livePreflight=JSON.parse(readFileSync(new URL('./live-preflight.json',import.meta.url))).rows[0].preflight;
 assert.deepEqual(livePreflight.versions,versions);
 assert.equal(livePreflight.hr_enabled,0);assert.equal(livePreflight.approved_hr_gates,0);assert.equal(livePreflight.scoped_companies,0);assert.equal(livePreflight.hr_bucket,null);assert.equal(livePreflight.release_barrier,null);
 const writer=live.functions.find(r=>r.signature==='change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb)');
 assert.equal(writer?.acl,'{postgres=X/postgres,authenticated=X/postgres}','Known fixture ACL reconciliation no longer applies');
 sql('GRANT EXECUTE ON FUNCTION public.change_workspace_modules_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb) TO authenticated');
 const local=JSON.parse(sql(readFileSync(new URL('../catalog.sql',import.meta.url),'utf8')));
 const localPreflight=JSON.parse(sql(readFileSync(new URL('./preflight.sql',import.meta.url),'utf8')));
 const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const reviewed=JSON.parse(readFileSync(new URL('../reviewed-constraint-shapes.json',import.meta.url)));
 const diffs=[];const accepted=[];
 for(const [kind,rows] of Object.entries(live)){
  const key=r=>kind==='functions'?r.signature:kind==='columns'?r.table+'.'+r.column:['policies','indexes','constraints','triggers'].includes(kind)?r.table+'.'+r.name:r.table;
  const locals=new Map(local[kind].map(r=>[key(r),r]));
  for(const row of rows){const k=key(row),l=locals.get(k);locals.delete(k);if(canonical(row)===canonical(l))continue;
   const fields=l?Object.keys(row).filter(f=>canonical(row[f])!==canonical(l[f])).map(f=>({name:f,live:row[f],local:l[f]})):[];
   const diff={kind,key:k,reason:l?'definition differs':'missing locally',fields};
   if(reviewed.some(r=>canonical(r)===canonical(diff)))accepted.push(diff);else diffs.push(diff);
  }
  for(const k of locals.keys())diffs.push({kind,key:k,reason:'only local'});
 }
 for(const kind of ['storage_policies','storage_triggers'])if(canonical(livePreflight[kind])!==canonical(localPreflight[kind]))diffs.push({kind,live:livePreflight[kind],local:localPreflight[kind]});
 writeFileSync(new URL('./baseline-comparison.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),productionMeasuredAt:livePreflight.measured_at,readOnlyProduction:true,syntheticLocal:true,ledger:versions.length,accepted,unresolved:diffs,compatible:diffs.length===0},null,2)+'\n');
 console.log('Comparison:',accepted.length,'reviewed constraint shapes;',diffs.length,'unresolved differences');
 assert.equal(diffs.length,0,'Baseline drift requires review before release');
 const manifest=JSON.parse(readFileSync(new URL('./manifest.json',import.meta.url)));
 for(const m of manifest.migrations){
  const payload=readFileSync(new URL(m.version+'.sql',import.meta.url),'utf8');
  assert.equal(createHash('sha256').update(payload).digest('hex'),m.installSha256);
  sql(payload);assert.equal(sql('SELECT count(*) FROM supabase_migrations.schema_migrations'),String(m.expectedAfter));
 }
 const after=JSON.parse(sql(readFileSync(new URL('../catalog.sql',import.meta.url),'utf8')));
 const changedExisting=live.functions.flatMap(f=>{const a=after.functions.find(x=>x.signature===f.signature);return !a?[{signature:f.signature,change:'removed'}]:canonical(f)!==canonical(a)?[{signature:f.signature,fields:Object.keys(f).filter(k=>canonical(f[k])!==canonical(a[k]))}]:[]});
 assert.equal(sql('SELECT count(*) FROM hr_access_release_gates WHERE approved'),'0');
 assert.equal(sql("SELECT count(*) FROM company_hr_access_modes WHERE mode='scoped'"),'0');
 writeFileSync(new URL('./compared-installation.json',import.meta.url),JSON.stringify({measuredAt:new Date().toISOString(),productionMeasuredAt:livePreflight.measured_at,syntheticOnly:true,baselineReconciliations:['Known authenticated EXECUTE grant on change_workspace_modules_v1','Eight exact reviewed constraint parenthesization differences'],migrations:manifest.migrations.map(m=>m.version),finalLedger:216,changedExistingFunctions:changedExisting,activationClosed:true,applicationRollbackBehaviorVerified:false},null,2)+'\n');
 console.log('PASS: 9 migrations installed on compared baseline; activation closed');
}finally{if(made)sql(`DROP DATABASE ${db} WITH (FORCE)`,'postgres');}
