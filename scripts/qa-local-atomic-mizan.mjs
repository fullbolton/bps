// Only guarded dedicated local Supabase, synthetic identities and files. Never reads .env.local.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 release=acquireLock();const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.financial_summaries'))='BPS synthetic financial reader fixture v1'"),'t');
 const existing=sql("SELECT coalesce(obj_description(to_regclass('public.mizan_uploads')),'absent')");
 if(existing==='absent'){
  assert.equal(sql("SELECT to_regclass('public.mizan_uploads') IS NULL"),'t');
  for(const f of ['20260415000100_create_mizan_tables.sql','20260415000200_mizan_match_status_consistency.sql'])sql(readFileSync(new URL('../supabase/migrations/'+f,import.meta.url),'utf8'));
  sql("COMMENT ON TABLE mizan_uploads IS 'BPS synthetic mizan fixture v1'; CREATE FUNCTION public.derive_financial_summaries_from_mizan(uuid) RETURNS int LANGUAGE sql AS 'SELECT 0';");
 }else assert.equal(existing,'BPS synthetic mizan fixture v1');
 sql("ALTER TABLE financial_summaries ALTER COLUMN id SET DEFAULT gen_random_uuid(), ADD COLUMN IF NOT EXISTS last_source text, ADD COLUMN IF NOT EXISTS confirmed_by uuid, ADD COLUMN IF NOT EXISTS confirmed_at timestamptz, ADD COLUMN IF NOT EXISTS created_by uuid, ADD COLUMN IF NOT EXISTS updated_at timestamptz;");
 if(sql("SELECT to_regprocedure('public.confirm_mizan_atomic(uuid,uuid,jsonb)') IS NULL")==='t')sql(readFileSync(new URL('../supabase/migrations/20260909002600_atomic_mizan.sql',import.meta.url),'utf8'));
 sql("NOTIFY pgrst,'reload schema';");console.log('PASS atomic mizan applied only to guarded local fixtures');
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options),c=createClient(s.API_URL,s.ANON_KEY,options);
 const email=`setup-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);
 const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
 try{
  sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Aktivite kabul kullanıcısı'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);
  assert.ifError((await c.auth.signInWithPassword({email,password})).error);
  let uploadId=randomUUID();const companyId=randomUUID();
  sql(`INSERT INTO companies(id,tenant_id,name,status) VALUES('${companyId}','${id(1)}','Synthetic Luca acceptance','aktif')`);
  try{
   const payload={fileName:'synthetic.xlsx',rows:[{accountCode:'120.01.01.001',accountName:'Synthetic',borcTotal:123,alacakTotal:0,borcBakiyesi:123,alacakBakiyesi:0,matchStatus:'matched',matchedCompanyId:companyId}]};
   const recovery=await importActualTypeScript(new URL('../src/lib/luca/pending-import.ts',import.meta.url));
   const disk=new Map();const storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v),removeItem:k=>disk.delete(k)};const locks={request:async(k,fn)=>fn()};const scope={actorId:uid,tenantId:id(1)};
   uploadId=await recovery.reserveMizan(scope,'a'.repeat(64),payload,storage,locks);
   const args={p_id:uploadId,p_tenant_id:id(1),p_payload:payload};let response;
   for(let i=0;i<20;i++){response=await c.rpc('confirm_mizan_atomic',args);if(!response.error)break;await new Promise(r=>setTimeout(r,150));}
   assert.ifError(response.error);const recovered=await recovery.reserveMizan(scope,'a'.repeat(64),payload,{...storage},locks);assert.equal(recovered,uploadId);assert.equal((await c.rpc('confirm_mizan_atomic',args)).data,uploadId);
   assert.equal(sql(`SELECT count(*) FROM mizan_upload_rows WHERE upload_id='${uploadId}'`),'1');assert.equal(sql(`SELECT open_receivable FROM financial_summaries WHERE company_id='${companyId}'`),'123.00');
   assert.ok((await c.rpc('confirm_mizan_atomic',{...args,p_tenant_id:id(2)})).error);
   assert.ok((await c.rpc('derive_financial_summaries_from_mizan',{p_upload_id:uploadId})).error);
   await recovery.settleMizan(scope,uploadId,storage,locks);assert.equal(disk.size,0);
   console.log('PASS real Auth + recovered identity: one durable snapshot/balance after retry, foreign tenant and legacy RPC rejected');
  }finally{sql(`DELETE FROM mizan_uploads WHERE id='${uploadId}'; DELETE FROM financial_summaries WHERE company_id='${companyId}'; DELETE FROM companies WHERE id='${companyId}'`);}

 }finally{sql(`DELETE FROM tenant_memberships WHERE user_id='${uid}'; DELETE FROM profiles WHERE id='${uid}'`);assert.ifError((await root.auth.admin.deleteUser(uid)).error);}

}catch(error){console.error('Atomic mizan local apply failed: '+error.message);process.exitCode=1;}
finally{release?.();}
