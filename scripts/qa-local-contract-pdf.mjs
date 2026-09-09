// Guarded dedicated local test. Real local GoTrue sessions, synthetic users only.
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>{try{return execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});}catch{throw new Error(cmd+' local command failed');}};
let release;
try{
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect','supabase_db_bps-supabase-acceptance','supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);
 const sql=q=>run('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],q).trim();release=acquireLock();
 assert.equal(sql("SELECT obj_description(to_regclass('public.tasks'))='BPS synthetic task-prefill fixture v1' AND to_regclass('public.task_transfer_receipts') IS NOT NULL"),'t');
 sql(readFileSync(new URL('./fixtures/local-documents.sql',import.meta.url),'utf8'));
 sql(readFileSync(new URL('./fixtures/local-document-storage.sql',import.meta.url),'utf8'));
 const migration=readFileSync(new URL('../supabase/migrations/20260909001800_contract_document_versions.sql',import.meta.url),'utf8');
 if(sql("SELECT to_regclass('public.contract_document_versions') IS NULL")==='t')sql(migration);
 else if(sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='documents' AND column_name='contract_document_role'")==='0'){const bodies=[...migration.matchAll(/CREATE FUNCTION [\s\S]*?\$\$;/g)].map(m=>m[0].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));assert.equal(bodies.length,7);sql("BEGIN; SET LOCAL lock_timeout='15s';"+bodies.join('\n')+'COMMIT;');}
 if(sql("SELECT indisunique FROM pg_index WHERE indexrelid='public.contract_document_versions_path_idx'::regclass")==='f')sql('BEGIN; DROP INDEX public.contract_document_versions_path_idx; CREATE UNIQUE INDEX contract_document_versions_path_idx ON public.contract_document_versions(storage_path); COMMIT;');
 sql('REVOKE ALL ON FUNCTION public.contracts_guard_pdf_context() FROM PUBLIC,anon,authenticated;');
 if(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.contracts'::regclass AND tgname='contracts_guard_pdf_context'")==='0')sql('CREATE TRIGGER contracts_guard_pdf_context BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.contracts_guard_pdf_context();');
 sql('REVOKE ALL ON FUNCTION public.can_read_retained_contract_object(text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_read_retained_contract_object(text,text) TO authenticated;');
 if(sql("SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='contract_versions_verify_object_read'")==='0')sql('CREATE POLICY contract_versions_verify_object_read ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(public.can_read_retained_contract_object(bucket_id,name));');
 sql("NOTIFY pgrst,'reload schema';");
 const options={auth:{persistSession:false,autoRefreshToken:false}},root=createClient(s.API_URL,s.SERVICE_ROLE_KEY,options);
 if((await root.storage.getBucket('documents')).error)assert.ifError((await root.storage.createBucket('documents',{public:false,fileSizeLimit:10485760,allowedMimeTypes:['application/pdf']})).error);
 async function user(name,role){const email=`pdf-${randomUUID()}@example.test`,password=randomUUID()+'aA1!';const created=await root.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(created.error);const uid=created.data.user.id;assert.match(uid,/^[0-9a-f-]{36}$/);sql(`INSERT INTO profiles(id,role,display_name) VALUES('${uid}','${role}','${name}'); INSERT INTO tenant_memberships VALUES('${uid}','${id(1)}');`);return {uid,email,password};}
 const actor=await user('PDF kabul yoneticisi','yonetici'),op=await user('PDF kabul operasyon','operasyon');
 const c=createClient(s.API_URL,s.ANON_KEY,options),o=createClient(s.API_URL,s.ANON_KEY,options);assert.ifError((await c.auth.signInWithPassword({email:actor.email,password:actor.password})).error);assert.ifError((await o.auth.signInWithPassword({email:op.email,password:op.password})).error);
 const contractId=randomUUID();sql(`INSERT INTO contracts(id,tenant_id,company_id,name) VALUES('${contractId}','${id(1)}','${id(20)}','Yerel PDF surum kabulü');`);
 const service=await importActualTypeScript(new URL('../src/lib/services/contract-pdf.ts',import.meta.url)),documents=await importActualTypeScript(new URL('../src/lib/services/documents.ts',import.meta.url));
 const scope={actorId:actor.uid,tenantId:id(1)};let ready=false;for(let i=0;i<20;i++){try{await service.loadContractPdfVersions(c,scope,contractId);ready=true;break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready);
 let count=0;const pass=label=>{count++;console.log('PASS '+label);};
 function pdf(label){const body=`BT /F1 18 Tf 50 750 Td (${label}) Tj ET`;const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`];let data='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(data);data+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(data);}
 const bytes1=pdf('BPS SYNTHETIC VERSION ONE'),bytes2=pdf('BPS SYNTHETIC VERSION TWO');
 const path1=`${id(20)}/${randomUUID()}.pdf`,path2=`${id(20)}/${randomUUID()}.pdf`,path3=`${id(20)}/${randomUUID()}.pdf`;
 for(const [path,bytes]of [[path1,bytes1],[path2,bytes2],[path3,bytes1]])assert.ifError((await c.storage.from('documents').upload(path,bytes,{contentType:'application/pdf',upsert:false})).error);
 const created=await c.from('documents').insert({tenant_id:id(1),company_id:id(20),contract_id:contractId,name:'BPS-v1.pdf',category:'cerceve_sozlesme',storage_path:path1,status:'tam',uploaded_by:'Spoofed'}).select().single();assert.ifError(created.error);assert.equal(created.data.uploaded_by,'PDF kabul yoneticisi');pass('real Storage upload creates a version with database actor label');
 const updated=await documents.updateContractDocumentFile(c,created.data.id,{name:'BPS-v2.pdf',storagePath:path2,uploadedBy:'Spoofed'},created.data.revision);assert.equal(updated.revision,1);
 const history=await service.loadContractPdfVersions(c,scope,contractId);assert.equal(history.versions.length,2);assert.equal(history.versions[0].current,true);assert.equal(history.versions[1].current,false);pass('CAS replacement preserves both versions and identifies current file');
 for(const [v,expected]of [[history.versions[0],bytes2],[history.versions[1],bytes1]]){const url=await service.downloadContractPdfVersion(c,scope,v.id);const response=await fetch(url);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),expected);}pass('old and new signed downloads return their exact distinct PDF bytes');
 await assert.rejects(()=>documents.updateContractDocumentFile(c,created.data.id,{name:'Stale.pdf',storagePath:path3,uploadedBy:null},0));assert.equal((await service.loadContractPdfVersions(c,scope,contractId)).versions.length,2);pass('stale replacement rejects; successful separate upload remains unreferenced');
 // Observe actual Storage deletion while version publication holds the object row.
 const raceName='bps-pdf-race-'+randomUUID();
 const tx=spawn('docker',['exec','-i','supabase_db_bps-supabase-acceptance','psql','-U','postgres','-d','postgres','-At','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']});
 let txOutput='';tx.stdout.on('data',chunk=>{txOutput+=chunk.toString();});tx.stderr.on('data',()=>{});
 const txDone=new Promise(resolve=>tx.on('close',resolve));
 let removal;
 try{
  tx.stdin.write(`BEGIN; SET application_name='${raceName}'; SET LOCAL statement_timeout='10s'; SELECT set_config('request.jwt.claims','{"sub":"${actor.uid}","role":"authenticated","app_metadata":{"active_tenant":"${id(1)}"}}',true); UPDATE documents SET storage_path='${path3}',name='Race.pdf' WHERE id='${created.data.id}'; SELECT 'RACE_READY';\n`);
  for(let i=0;i<100&&!txOutput.includes('RACE_READY');i++)await new Promise(resolve=>setTimeout(resolve,30));assert.ok(txOutput.includes('RACE_READY'),'publication transaction must reach row lock');
  const pid=Number(sql(`SELECT pid FROM pg_stat_activity WHERE application_name='${raceName}'`));assert.ok(Number.isSafeInteger(pid)&&pid>0);
  removal=c.storage.from('documents').remove([path3]);let blocked=false;
  for(let i=0;i<100;i++){if(sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE ${pid}=ANY(pg_blocking_pids(a.pid)))`)==='t'){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,30));}
  assert.ok(blocked,'actual Storage request must wait on object row');tx.stdin.end('COMMIT;\n');assert.equal(await txDone,0);await removal;
  const kept=await c.storage.from('documents').download(path3);assert.ifError(kept.error);assert.deepEqual(Buffer.from(await kept.data.arrayBuffer()),bytes1);
  assert.equal((await service.loadContractPdfVersions(c,scope,contractId)).versions.length,3);pass('concurrent Storage remove waits for publication and leaves committed PDF bytes intact');
 }finally{if(tx.exitCode===null)tx.stdin.end('ROLLBACK;\n');await txDone;await removal?.catch(()=>{});}
 const deleted=await c.from('documents').delete().eq('id',created.data.id);assert.ok(deleted.error);pass('document hard delete is blocked before application storage cleanup');
 await c.storage.from('documents').remove([path1,path2]);
 for(const [path,expected]of [[path1,bytes1],[path2,bytes2]]){const got=await c.storage.from('documents').download(path);assert.ifError(got.error);assert.deepEqual(Buffer.from(await got.data.arrayBuffer()),expected);}pass('real Storage remove cannot delete retained old or current bytes');
 const overwrite=await c.storage.from('documents').upload(path1,bytes2,{contentType:'application/pdf',upsert:true});assert.ok(overwrite.error);pass('Storage upsert cannot overwrite a retained version');
 const opHistory=await service.loadContractPdfVersions(o,{actorId:op.uid,tenantId:id(1)},contractId);assert.equal(opHistory.versions.length,3);const opUrl=await service.downloadContractPdfVersion(o,{actorId:op.uid,tenantId:id(1)},opHistory.versions[1].id);assert.equal((await fetch(opUrl)).status,200);pass('real operations role reads and downloads retained versions');
 await assert.rejects(()=>service.downloadContractPdfVersion(c,{actorId:actor.uid,tenantId:id(2)},history.versions[0].id));pass('forged tenant scope cannot resolve a version path');
 // Stable browser fixture is separate from the API assertions; never change an existing fixture document.
 if(sql(`SELECT count(*) FROM documents WHERE contract_id='${id(400)}'`)==='0'){
 const bp1=`${id(20)}/${randomUUID()}.pdf`,bp2=`${id(20)}/${randomUUID()}.pdf`;
 for(const [path,bytes]of [[bp1,bytes1],[bp2,bytes2]])assert.ifError((await c.storage.from('documents').upload(path,bytes,{contentType:'application/pdf'})).error);
 const d=await c.from('documents').insert({tenant_id:id(1),company_id:id(20),contract_id:id(400),name:'Sentetik-v1.pdf',category:'cerceve_sozlesme',storage_path:bp1,status:'tam'}).select().single();assert.ifError(d.error);
 await documents.updateContractDocumentFile(c,d.data.id,{name:'Sentetik-v2.pdf',storagePath:bp2,uploadedBy:null},d.data.revision);
 }
 writeFileSync('/private/tmp/bps-synthetic-v1.pdf',bytes1,{mode:0o600});writeFileSync('/private/tmp/bps-synthetic-v2.pdf',bytes2,{mode:0o600});
 console.log(`Local contract PDF checks: ${count} passed. Synthetic files available in /private/tmp/bps-synthetic-v1.pdf and /private/tmp/bps-synthetic-v2.pdf.`);
}catch(error){console.error('Local PDF acceptance failed: '+error.message);process.exitCode=1;}
finally{release?.();}
