// Only guarded dedicated local Supabase, synthetic identities and files. Never reads .env.local.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
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
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1' AND to_regclass('public.contract_document_versions') IS NOT NULL"),'t');
 const migration=readFileSync(new URL('../supabase/migrations/20260909001900_contract_pdf_upload_commands.sql',import.meta.url),'utf8');
 if(sql("SELECT to_regclass('public.contract_pdf_upload_commands') IS NULL")==='t')sql(migration);
 else if(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='contract_document_role'")==='0'){const bodies=[...migration.matchAll(/CREATE FUNCTION [\s\S]*?\$\$;/g)].map(m=>m[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));assert.equal(bodies.length,8);sql("BEGIN;SET LOCAL lock_timeout='15s';"+bodies.join('\n')+'COMMIT;');}
 if(sql("SELECT confdeltype FROM pg_constraint WHERE conrelid='public.contract_pdf_upload_commands'::regclass AND conname='contract_pdf_upload_commands_contract_id_fkey'")==='c')sql("BEGIN;ALTER TABLE contract_pdf_upload_commands DROP CONSTRAINT contract_pdf_upload_commands_contract_id_fkey;ALTER TABLE contract_pdf_upload_commands ADD CONSTRAINT contract_pdf_upload_commands_contract_id_fkey FOREIGN KEY(contract_id) REFERENCES contracts(id) ON DELETE RESTRICT;COMMIT;");
 if(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.contracts'::regclass AND tgname='contracts_guard_upload_context'")==='0')sql("CREATE TRIGGER contracts_guard_upload_context BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.guard_contract_upload_context();REVOKE ALL ON FUNCTION public.guard_contract_upload_context() FROM PUBLIC,anon,authenticated;");
 sql("NOTIFY pgrst,'reload schema';");
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
 const email=`upload-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';
 const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);
 sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','yonetici','Yukleme kabul yoneticisi'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);
 const jar=new Map(),login=createServerClient(s.API_URL,s.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 const signed=await login.auth.signInWithPassword({email,password});assert.ifError(signed.error);
 let drop=null,dropped=0;
 const c=createClient(s.API_URL,s.ANON_KEY,{...options,global:{headers:{Authorization:`Bearer ${signed.data.session.access_token}`},fetch:async(input,init)=>{
  const response=await fetch(input,init),path=new URL(typeof input==='string'?input:input.url??String(input)).pathname;
  if(drop&&path.includes(drop)&&response.ok&&init?.method==='POST'){await response.arrayBuffer();drop=null;dropped++;throw Error('Synthetic response loss after real commit');}return response;
 }}});
 const service=await importActualTypeScript(new URL('../src/lib/services/pdf-upload.ts',import.meta.url)),boundary=await importActualTypeScript(new URL('../src/lib/pdf-upload.ts',import.meta.url));
 const scope={actorId:uid,tenantId:id(1)},bytes=readFileSync('/private/tmp/bps-synthetic-v1.pdf');
 const buffer=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
 async function command(size=bytes.length){const contractId=randomUUID();sql(`INSERT INTO contracts(id,tenant_id,company_id,name) VALUES('${contractId}','${id(1)}','${id(20)}','Sentetik devamli PDF');`);const content=Buffer.alloc(size,32);bytes.copy(content,0,0,Math.min(size,bytes.length));return {content:buffer(content),command:{commandId:randomUUID(),contractId,expectedDocumentId:null,expectedRevision:null,filename:'Sentetik.pdf',byteSize:size,sha256:await boundary.pdfDigest(buffer(content))}};}
 let count=0;const pass=label=>{count++;console.log('PASS '+label);};
 let item=await command();let ready=false;for(let i=0;i<25;i++){try{await service.getPdfUpload(c,scope,item.command);ready=true;break;}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
 drop='/rpc/prepare_contract_pdf_upload';await assert.rejects(()=>service.executePdfUpload(c,scope,item.command,item.content));assert.equal((await service.getPdfUpload(c,scope,item.command)).state,'pending');assert.equal((await service.executePdfUpload(c,scope,item.command,item.content)).state,'published');pass('prepare response lost after real commit; same command resumes and publishes');
 item=await command();drop='/storage/v1/object/documents/';assert.equal((await service.executePdfUpload(c,scope,item.command,item.content)).state,'published');pass('real Storage response lost; readback verifies bytes and finish succeeds');
 item=await command();drop='/rpc/finish_contract_pdf_upload';await assert.rejects(()=>service.executePdfUpload(c,scope,item.command,item.content));const recovered=await service.getPdfUpload(c,scope,item.command);assert.equal(recovered.state,'published');assert.deepEqual(await service.executePdfUpload(c,scope,item.command,item.content),recovered);assert.equal(sql(`SELECT count(*) FROM contract_document_versions WHERE contract_id='${item.command.contractId}'`),'1');assert.equal(dropped,3);pass('finish response lost; fresh status and retry return one committed version');
 item=await command();const reserved=await service.preparePdfUpload(c,scope,item.command);assert.ifError((await c.storage.from('documents').upload(reserved.path,item.content,{contentType:'application/pdf'})).error);
 await c.storage.from('documents').remove([reserved.path]);assert.ifError((await c.storage.from('documents').download(reserved.path)).error);assert.ok((await c.storage.from('documents').upload(reserved.path,item.content,{contentType:'application/pdf',upsert:true})).error);pass('real pending Storage bytes survive remove and cannot be overwritten');
 assert.equal((await service.preparePdfUpload(c,scope,item.command,true)).state,'cancelled');await assert.rejects(()=>service.executePdfUpload(c,scope,item.command,item.content),/CANCELLED/);pass('real cancellation prevents delayed resume');
 item=await command();assert.equal((await service.preparePdfUpload(c,scope,item.command,true)).state,'cancelled');await assert.rejects(()=>service.executePdfUpload(c,scope,item.command,item.content),/CANCELLED/);pass('real cancel-before-prepare tombstone prevents a delayed first request');
 async function http(item,{origin='http://localhost:3000',tenantId=id(1)}={}){
  const form=new FormData();form.set('command',JSON.stringify(item.command));form.set('file',new Blob([item.content],{type:'application/pdf'}),'Sentetik.pdf');form.set('actorId',uid);form.set('tenantId',tenantId);
  const response=await fetch('http://localhost:3000/api/contracts/pdf-upload',{method:'POST',headers:{origin,cookie:[...jar].map(([n,v])=>n+'='+v).join('; ')},body:form,signal:AbortSignal.timeout(90000)});return {status:response.status,result:await response.json()};
 }
 for(const size of [1024*1024+32,10*1024*1024]){item=await command(size);const response=await http(item);assert.equal(response.status,200,JSON.stringify(response.result));assert.equal(response.result.ok,true);assert.equal(response.result.receipt.state,'published');const stored=await c.storage.from('documents').download(response.result.receipt.path);assert.ifError(stored.error);assert.equal(await boundary.pdfDigest(await stored.data.arrayBuffer()),item.command.sha256);}pass('actual Next HTTP route accepts >1 MiB and exactly 10 MiB; stored hashes match');
 item=await command();assert.equal((await http(item,{origin:'https://other.invalid'})).status,403);assert.equal((await http(item,{tenantId:id(2)})).result.ok,false);assert.equal(await service.getPdfUpload(c,scope,item.command),null);pass('HTTP origin and tenant mismatch reject before creating intent');
 const oversized={...item,command:{...item.command,byteSize:10*1024*1024+1},content:buffer(Buffer.alloc(10*1024*1024+1,32))};assert.equal((await http(oversized)).result.ok,false);assert.equal(await service.getPdfUpload(c,scope,item.command),null);pass('HTTP oversized file cannot create intent');
 sql(`UPDATE profiles SET role='operasyon' WHERE id='${uid}'`);await assert.rejects(()=>service.preparePdfUpload(c,scope,item.command));sql(`UPDATE profiles SET role='yonetici' WHERE id='${uid}'; DELETE FROM tenant_memberships WHERE user_id='${uid}'`);await assert.rejects(()=>service.getPdfUpload(c,scope,item.command));pass('actual role revocation and stale claim fail closed');
 console.log(`Local PDF upload checks: ${count} passed.`);
}catch(error){console.error('Local PDF upload acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
