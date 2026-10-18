import {loadFixtureMigrations} from '../module-change-command-20261017/fixture-migrations.mjs';
// Disposable LOCAL Storage HTTP acceptance. No production URLs or credentials.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {randomBytes,createHmac} from 'node:crypto';
import assert from 'node:assert/strict';
import http from 'node:http';
const source='supabase_db_bps-supabase-acceptance',network='supabase_network_bps-supabase-acceptance';
const suffix=process.pid,database=`bps_storage_http_${suffix}`,storage=`bps-storage-http-${suffix}`,rest=`bps-storage-rest-${suffix}`;
const secrets=[];
const redact=s=>secrets.reduce((text,secret)=>text.split(secret).join('[redacted]'),String(s));
function docker(args,input){try{return execFileSync('docker',args,{input,encoding:'utf8',timeout:20000,stdio:['pipe','pipe','pipe']}).trim();}catch(e){throw Error(redact(e.stderr||'Docker operation failed'));}}
function sql(query,db=database){return docker(['exec','-i',source,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],query);}
function logs(){const r=spawnSync('docker',['logs','--tail','8',storage],{encoding:'utf8',timeout:5000});return (r.stdout||'')+(r.stderr||'');}
const password=docker(['exec',source,'printenv','POSTGRES_PASSWORD']);secrets.push(password);
const secret=randomBytes(48).toString('hex');secrets.push(secret);
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function jwt(role,actor=11,tenant=1,extra={}){const data=[{alg:'HS256',typ:'JWT'},{role,sub:id(actor),active_tenant_id:id(tenant),exp:Math.floor(Date.now()/1000)+600,...extra}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');const token=data+'.'+createHmac('sha256',secret).update(data).digest('base64url');secrets.push(token);return token;}
const token=jwt('authenticated'),foreign=jwt('authenticated',12,2),anon=jwt('anon'),service=jwt('service_role');
const uri=`postgres://${process.env.BPS_RELEASE_BARRIER==='1'?'authenticator':'postgres'}:${encodeURIComponent(password)}@${source}:5432/${database}`;secrets.push(uri);
const storageUri=`postgres://supabase_storage_admin:${encodeURIComponent(password)}@${source}:5432/${database}`;secrets.push(storageUri);
let created=false;
const checks=[];
const migrations=loadFixtureMigrations();
const claim=`SELECT set_config('request.jwt.claims','${JSON.stringify({sub:id(11),active_tenant_id:id(1)})}',true);SET LOCAL ROLE authenticated;`;
const pdf=Buffer.from('%PDF-1.4\nSynthetic local acceptance file\n%%EOF\n');
try {
 sql(`CREATE DATABASE ${database} TEMPLATE bps_module_chain_20261005;`,'postgres');created=true;
 // The catalog snapshot has no Storage migration ledger. Bootstrap official
 // Storage in this disposable clone; preserve every BPS Storage policy exactly.
 const policies=sql(`SELECT format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',policyname,schemaname,tablename,permissive,cmd,
 (SELECT string_agg(quote_ident(r),',') FROM unnest(roles) r),
 CASE WHEN qual IS NULL THEN '' ELSE ' USING ('||qual||')' END,
 CASE WHEN with_check IS NULL THEN '' ELSE ' WITH CHECK ('||with_check||')' END)
 FROM pg_policies WHERE schemaname='storage' ORDER BY tablename,policyname;`);
 const schemaUsage=sql("SELECT format('GRANT USAGE ON SCHEMA storage TO %I;',rolname) FROM pg_roles WHERE rolname IN ('postgres','anon','authenticated','service_role','dashboard_user') AND has_schema_privilege(oid,'storage','USAGE');");
 const functionsBefore=sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace;");
 docker(['exec','-i','-e',`PGPASSWORD=${password}`,source,'psql','-w','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],`DROP SCHEMA storage CASCADE;CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;GRANT CONNECT,CREATE ON DATABASE ${database} TO supabase_storage_admin;`);
 assert.equal(sql("SELECT count(*) FROM pg_proc WHERE pronamespace='public'::regnamespace;"),functionsBefore,'Storage rebuild removed a public function');
 const run=(name,image,env,port)=>docker(['run','-d','--name',name,'--network',network,...(port?['-p',`127.0.0.1::${port===true?5000:port}`]:[]),...Object.entries(env).flatMap(([k,v])=>['-e',`${k}=${v}`]),image]);
 run(rest,'public.ecr.aws/supabase/postgrest:v14.3',{PGRST_DB_URI:uri,PGRST_DB_SCHEMAS:'public,storage',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret},3000);
 const startStorage=()=>run(storage,'public.ecr.aws/supabase/storage-api:v1.35.3',{ANON_KEY:anon,SERVICE_KEY:service,AUTH_JWT_SECRET:secret,POSTGREST_URL:`http://${rest}:3000`,DATABASE_URL:storageUri,DATABASE_SEARCH_PATH:'storage,public,extensions',STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/tmp/storage',TENANT_ID:'local-acceptance',REGION:'local',GLOBAL_S3_BUCKET:'local',FILE_SIZE_LIMIT:'10485760',ENABLE_IMAGE_TRANSFORMATION:'false'},true);
 startStorage();
 const port=docker(['port',storage,'5000/tcp']).split(':').at(-1);let base=`http://127.0.0.1:${port}`;
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(base+'/status',{signal:AbortSignal.timeout(500)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 if(!ready){const logs=docker(['logs','--tail','15',storage]);const errors=logs.split('\n').flatMap(line=>{try{const value=JSON.parse(line);return value.error?.message?[value.error.message]:[];}catch{return [];}});throw Error('Storage failed readiness: '+redact(errors.join('\n')||'No startup diagnostics'));}
 docker(['exec','-i','-e',`PGPASSWORD=${password}`,source,'psql','-w','-X','-qAt','-U','supabase_admin','-d',database,'-v','ON_ERROR_STOP=1'],schemaUsage);
 sql(policies);
 for(const name of migrations)sql(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 sql(`INSERT INTO companies(id,tenant_id,name) VALUES('${id(991)}','${id(1)}','Synthetic HTTP');INSERT INTO storage.buckets(id,name,public) VALUES('documents','documents',false) ON CONFLICT DO NOTHING;`);
 async function request(path,method='GET',body,auth=token,headers={}){
  const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${auth}`,...headers},body,signal:AbortSignal.timeout(10000)});
  return {status:r.status,ok:r.ok,text:await r.text()};
 }
 // Restart only the disposable PostgREST after migrations so its schema cache
 // is ready before issuing any write. Readiness retries never replay mutations.
 docker(['restart',rest]);
 const restPort=docker(['port',rest,'3000/tcp']).split(':').at(-1);
 let restBase=`http://127.0.0.1:${restPort}`;
 let rpcReady=false;
 for(let i=0;i<50;i++){
  try{const r=await fetch(restBase+'/',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(500)});if(r.ok&&(await r.text()).includes('document_finalize_upload_v1')){rpcReady=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.ok(rpcReady,'PostgREST schema cache unavailable');
 async function rpcResult(name,args,auth=token){
  let r;try{r=await fetch(restBase+'/rpc/'+name,{method:'POST',headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});}catch(error){throw Error(name+': '+error.message+' DB waits: '+sql("SELECT json_agg(x) FROM (SELECT state,wait_event_type,wait_event,pg_blocking_pids(pid) AS blocked_by,left(query,160) AS query FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()) x;"));}
  const text=await r.text();return {ok:r.ok,status:r.status,data:text?JSON.parse(text):null};
 }
 async function rpc(name,args){const r=await rpcResult(name,args);assert.ok(r.ok,`${name}: ${r.status} ${JSON.stringify(r.data)}`);return r.data;}
 if(process.env.BPS_MODULE_STORAGE_HTTP==='1') {
  const {acceptModuleStorage}=await import('../module-change-command-20261017/storage-http-acceptance.mjs');
  checks.push(...await acceptModuleStorage({sql,request,id,pdf,token,foreign,anon}));
 }
 const scope={p_tenant:id(1),p_id:id(992)};
 const preparation={...scope,p_company:id(991),p_name:'Synthetic PDF',p_category:'diger',p_validity:null,p_size:pdf.length};
 assert.equal((await rpcResult('document_prepare_upload_v1',preparation,foreign)).ok,false);
 assert.equal((await rpcResult('document_prepare_upload_v1',preparation,anon)).ok,false);
 checks.push('foreign and anonymous RPC preparation denied');
 const path=`${id(991)}/${id(992)}.pdf`;
 const unreserved=await request('/object/documents/'+`${id(991)}/${id(994)}.pdf`,'POST',pdf,token,{'Content-Type':'application/pdf'});
 assert.equal(unreserved.ok,false);checks.push('unreserved HTTP upload denied');
 assert.equal(await rpc('document_prepare_upload_v1',preparation),path);
 checks.push('preparation through authenticated HTTP RPC');
 const upload=await request('/object/documents/'+path,'POST',pdf,token,{'Content-Type':'application/pdf','x-upsert':'false'});
 assert.ok(upload.ok,`upload ${upload.status}: ${upload.text}`);checks.push('authenticated HTTP upload');
 const owner=sql(`SELECT owner_id FROM storage.objects WHERE bucket_id='documents' AND name='${path}';`);assert.equal(owner,id(11));checks.push('Storage records caller ownership');
 const recovery=await rpc('document_upload_recovery_target_v1',scope);
 assert.equal(recovery.storage_path,path);assert.equal(recovery.file_size,pdf.length);
 const pendingDownload=await request('/object/authenticated/documents/'+recovery.storage_path);
 assert.ok(pendingDownload.ok);assert.equal(pendingDownload.text,pdf.toString());checks.push('pending recovery target and HTTP bytes verified');
 const finish=()=>rpc('document_finalize_upload_v1',scope);
 assert.equal(await finish(),id(992));assert.equal(await finish(),id(992));checks.push('finalize and idempotent receipt');
 if(process.env.BPS_RESTORE_REHEARSAL==='1'){
  const {restoreStorageFixture}=await import('../synthetic-restore-20261018/storage-restore.mjs');
  const restorePending={p_tenant:id(1),p_id:id(9501)},restoreCancelled={p_tenant:id(1),p_id:id(9502)},restoreEmpty={p_tenant:id(1),p_id:id(9503)};
  const pendingPath=await rpc('document_prepare_upload_v1',{...preparation,p_id:restorePending.p_id});
  const cancelledPath=await rpc('document_prepare_upload_v1',{...preparation,p_id:restoreCancelled.p_id});
  await rpc('document_prepare_upload_v1',{...preparation,p_id:restoreEmpty.p_id});
  for(const file of [pendingPath,cancelledPath])assert.ok((await request('/object/documents/'+file,'POST',pdf,token,{'Content-Type':'application/pdf'})).ok);
  assert.equal(await rpc('document_cancel_upload_v1',restoreCancelled),true);
  const restored=await restoreStorageFixture({source,database,storage,rest,startStorage,docker,sql,token,path,pdf});
  base=restored.base;restBase=restored.restBase;checks.push(...restored.checks);
  const pendingRows=await rpc('document_pending_uploads_v1',{p_tenant:id(1),p_offset:0});
  assert.equal(pendingRows.find(x=>x.document_id===restorePending.p_id)?.can_resume,true);
  assert.equal(pendingRows.find(x=>x.document_id===restoreEmpty.p_id)?.file_present,false);
  assert.equal(pendingRows.some(x=>x.document_id===restoreCancelled.p_id),false);
  const recovered=await rpc('document_upload_recovery_target_v1',restorePending);
  assert.equal((await request('/object/authenticated/documents/'+recovered.storage_path)).text,pdf.toString());
  assert.equal(await rpc('document_finalize_upload_v1',restorePending),restorePending.p_id);
  assert.equal(await rpc('document_finalize_upload_v1',restorePending),restorePending.p_id);
  checks.push('restored pending upload retains bytes and publishes exactly once');
  assert.equal((await rpcResult('document_finalize_upload_v1',restoreCancelled)).ok,false);
  const cleanup=await request('/object/documents','DELETE',JSON.stringify({prefixes:[cancelledPath]}),token,{'Content-Type':'application/json'});
  assert.ok(cleanup.ok);assert.ok(JSON.parse(cleanup.text).some(x=>x.name===cancelledPath));
  assert.equal(await rpc('document_ack_cleanup_v1',{p_document_id:restoreCancelled.p_id}),true);
  assert.equal((await request('/object/documents/'+cancelledPath,'POST',pdf,token,{'Content-Type':'application/pdf'})).ok,false);
  checks.push('restored cancellation remains retired and queued cleanup completes');
  assert.equal(await rpc('document_cancel_upload_v1',restoreEmpty),true);
  assert.equal(await rpc('document_ack_cleanup_v1',{p_document_id:restoreEmpty.p_id}),true);
  checks.push('restored reservation without bytes can be cancelled safely');
 }
 const download=await request('/object/authenticated/documents/'+path);assert.ok(download.ok,download.text);assert.equal(download.text,pdf.toString());checks.push('authenticated byte-for-byte download');
 assert.equal((await request('/object/authenticated/documents/'+path,'GET',undefined,foreign)).ok,false);checks.push('foreign tenant download denied');
 assert.equal((await request('/object/documents/'+path,'PUT',pdf,token,{'Content-Type':'application/pdf'})).ok,false);checks.push('reserved object overwrite denied');
 await request('/object/documents','DELETE',JSON.stringify({prefixes:[path]}),token,{'Content-Type':'application/json'});
 assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${path}';`),'1');checks.push('premature HTTP deletion does not remove file');
 const edit={...scope,p_company:id(991),p_revision:0,p_kind:'category',p_value:'yetki_belgesi'};
 const edited=await rpc('document_edit_metadata_v1',edit);assert.equal(edited.revision,1);assert.equal(edited.category,'yetki_belgesi');
 const stale=await rpcResult('document_delete_v1',{...scope,p_company:id(991),p_revision:0});assert.equal(stale.ok,false);assert.equal(stale.status,409);assert.equal(stale.data.code,'PT409');
 const deleted=await rpc('document_delete_v1',{...scope,p_company:id(991),p_revision:1});assert.equal(deleted.storage_path,path);assert.equal(deleted.revision,1);
 checks.push('HTTP metadata edit and stale-delete rejection');
 const removed=await request('/object/documents','DELETE',JSON.stringify({prefixes:[path]}),token,{'Content-Type':'application/json'});
 assert.ok(removed.ok,removed.text);assert.ok(JSON.parse(removed.text).some(x=>x.name===path));
 assert.equal(await rpc('document_ack_cleanup_v1',{p_document_id:id(992)}),true);checks.push('HTTP cleanup and durable acknowledgement');
 const cancelledPath=`${id(991)}/${id(993)}.pdf`;
 await rpc('document_prepare_upload_v1',{...preparation,p_id:id(993),p_name:'Cancelled'});
 assert.equal(await rpc('document_cancel_upload_v1',{p_tenant:id(1),p_id:id(993)}),true);
 const lateUpload=await request('/object/documents/'+cancelledPath,'POST',pdf,token,{'Content-Type':'application/pdf'});
 assert.equal(lateUpload.ok,false);assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${cancelledPath}';`),'0');checks.push('cancelled upload rejected over HTTP');
 assert.equal(await rpc('document_ack_cleanup_v1',{p_document_id:id(993)}),true);
 const afterAck=await request('/object/documents/'+cancelledPath,'POST',pdf,token,{'Content-Type':'application/pdf'});
 assert.equal(afterAck.ok,false);assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${cancelledPath}';`),'0');checks.push('acknowledged cancellation remains retired');
 // Interrupted after Storage succeeds: inventory, recovery and concurrent finalize.
 const pending=()=>rpc('document_pending_uploads_v1',{p_tenant:id(1),p_offset:0});
 const resumed={p_tenant:id(1),p_id:id(9401)};
 const resumedPath=await rpc('document_prepare_upload_v1',{...preparation,p_id:resumed.p_id});
 assert.equal((await pending()).find(x=>x.document_id===resumed.p_id)?.file_present,false);
 assert.ok((await request('/object/documents/'+resumedPath,'POST',pdf,token,{'Content-Type':'application/pdf'})).ok);
 const interrupted=(await pending()).find(x=>x.document_id===resumed.p_id);
 assert.equal(interrupted?.file_present,true);assert.equal(interrupted?.can_resume,true);
 const target=await rpc('document_upload_recovery_target_v1',resumed);
 assert.equal((await request('/object/authenticated/documents/'+target.storage_path)).text,pdf.toString());
 const receipts=await Promise.all([rpc('document_finalize_upload_v1',resumed),rpc('document_finalize_upload_v1',resumed)]);
 assert.deepEqual(receipts,[resumed.p_id,resumed.p_id]);
 assert.equal(sql(`SELECT count(*) FROM documents WHERE id='${resumed.p_id}';`),'1');
 assert.equal((await pending()).some(x=>x.document_id===resumed.p_id),false);
 checks.push('interrupted upload inventory and concurrent recovery publish exactly one document');
 // Cancellation after bytes arrive must retain them until explicit queued cleanup.
 const abandoned={p_tenant:id(1),p_id:id(9402)};
 const abandonedPath=await rpc('document_prepare_upload_v1',{...preparation,p_id:abandoned.p_id});
 assert.ok((await request('/object/documents/'+abandonedPath,'POST',pdf,token,{'Content-Type':'application/pdf'})).ok);
 assert.equal(await rpc('document_cancel_upload_v1',abandoned),true);
 assert.equal((await pending()).some(x=>x.document_id===abandoned.p_id),false);
 assert.equal((await rpcResult('document_finalize_upload_v1',abandoned)).ok,false);
 assert.equal(sql(`SELECT count(*) FROM documents WHERE id='${abandoned.p_id}';`),'0');
 assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${abandonedPath}';`),'1');
 const cancelledRemoval=await request('/object/documents','DELETE',JSON.stringify({prefixes:[abandonedPath]}),token,{'Content-Type':'application/json'});
 assert.ok(cancelledRemoval.ok);assert.ok(JSON.parse(cancelledRemoval.text).some(x=>x.name===abandonedPath));
 assert.equal(await rpc('document_ack_cleanup_v1',{p_document_id:abandoned.p_id}),true);
 assert.equal((await request('/object/documents/'+abandonedPath,'POST',pdf,token,{'Content-Type':'application/pdf'})).ok,false);
 checks.push('uploaded cancellation prevents finalize and retires path after queued HTTP cleanup');
 sql(`UPDATE companies SET status='aktif' WHERE id='${id(991)}';INSERT INTO contracts(id,company_id,tenant_id,name) VALUES('${id(995)}','${id(991)}','${id(1)}','Synthetic contract HTTP');BEGIN;${claim}SELECT prepare_contract_document_upload('${id(11)}','${id(1)}','${id(995)}','${id(996)}',NULL,NULL,'contract.pdf',${pdf.length},repeat('a',64),false,'main',NULL);COMMIT;`);
 async function contractPreview(){
  const snapshot=await rpc('current_workspace_modules_v1',{});
  return rpc('preview_workspace_modules_v1',{p_expected_actor:id(11),p_expected_tenant:id(1),p_expected_revision:snapshot.configRevision,p_modules:{...snapshot.modules,contracts:false}});
 }
 assert.equal((await contractPreview()).checks.find(c=>c.code==='pending_contract_upload')?.blocking,true);
 const contractPath=sql(`SELECT storage_path FROM contract_pdf_upload_commands WHERE command_id='${id(996)}';`);
 sql(`BEGIN;SELECT 1 FROM tenant_module_config WHERE tenant_id='${id(1)}' FOR UPDATE;UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='contracts';COMMIT;`);
 assert.equal((await request('/object/documents/'+contractPath,'POST',pdf,token,{'Content-Type':'application/pdf'})).ok,false);
 assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${contractPath}';`),'0');
 sql(`BEGIN;SELECT 1 FROM tenant_module_config WHERE tenant_id='${id(1)}' FOR UPDATE;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='contracts';COMMIT;`);
 checks.push('closed contracts module rejects reserved contract HTTP upload');
 const contractUpload=await request('/object/documents/'+contractPath,'POST',pdf,token,{'Content-Type':'application/pdf'});
 assert.ok(contractUpload.ok,contractUpload.text);
 sql(`BEGIN;${claim}SELECT finish_contract_pdf_upload('${id(11)}','${id(1)}','${id(995)}','${id(996)}');COMMIT;`);
 assert.equal(sql(`SELECT state FROM contract_pdf_upload_commands WHERE command_id='${id(996)}';`),'published');checks.push('reserved contract HTTP upload and finalize remain available');
 // Synthetic legacy object: privileged fixture upload simulates pre-reservation data.
 const legacyPath=`${id(991)}/${id(997)}.pdf`;
 const legacy=await request('/object/documents/'+legacyPath,'POST',pdf,service,{'Content-Type':'application/pdf'});
 assert.ok(legacy.ok,legacy.text);
 sql(`INSERT INTO documents(id,tenant_id,company_id,name,category,status,storage_path) VALUES('${id(997)}','${id(1)}','${id(991)}','Synthetic legacy','diger','tam','${legacyPath}');`);
 assert.equal((await request('/object/documents/'+legacyPath,'PUT',Buffer.from('%PDF-replaced'),token,{'Content-Type':'application/pdf'})).ok,false);
 const moved=await request('/object/move','POST',JSON.stringify({bucketId:'documents',sourceKey:legacyPath,destinationKey:`${id(991)}/${id(998)}.pdf`}),token,{'Content-Type':'application/json'});
 assert.equal(moved.ok,false);checks.push('legacy overwrite and move denied');
 await request('/object/documents','DELETE',JSON.stringify({prefixes:[legacyPath]}),token,{'Content-Type':'application/json'});
 const retained=await request('/object/authenticated/documents/'+legacyPath);assert.ok(retained.ok);assert.equal(retained.text,pdf.toString());checks.push('legacy bytes retained before cleanup job');
 sql(`BEGIN;${claim}SELECT document_delete_v1('${id(1)}','${id(997)}','${id(991)}',0);COMMIT;`);
 const legacyRemoved=await request('/object/documents','DELETE',JSON.stringify({prefixes:[legacyPath]}),token,{'Content-Type':'application/json'});
 assert.ok(legacyRemoved.ok,legacyRemoved.text);assert.ok(JSON.parse(legacyRemoved.text).some(x=>x.name===legacyPath));
 assert.equal(sql(`BEGIN;${claim}SELECT document_ack_cleanup_v1('${id(997)}');COMMIT;`).split('\n').at(-1),'t');checks.push('legacy deletion works after durable cleanup job');
 assert.equal((await contractPreview()).checks.find(c=>c.code==='pending_contract_upload')?.blocking,false);
 checks.push('HTTP preview includes pending contract upload blocker and clears it after finalize');
 // Workspace conflicts are real HTTP calls, not direct SQL exception tests.
 async function conflict(name,args,message){const result=await rpcResult(name,args);assert.equal(result.status,409);assert.equal(result.data.code,'PT409');assert.equal(result.data.message,message);}
 const context=await rpc('current_workspace_modules_v1',{});
 await conflict('preview_workspace_modules_v1',{p_expected_actor:id(11),p_expected_tenant:id(1),p_expected_revision:'stale',p_modules:context.modules},'MODULE_PREVIEW_STALE');
 const preview=await rpc('preview_workspace_modules_v1',{p_expected_actor:id(11),p_expected_tenant:id(1),p_expected_revision:context.configRevision,p_modules:context.modules});
 assert.equal(preview.advisoryOnly,true);assert.equal(preview.mutationAvailable,false);
 checks.push('stale module preview returns HTTP 409; current preview stays advisory');
 const memberArgs={p_user_id:id(11),p_tenant_id:id(1),p_action:'add',p_role:'operasyon'};
 sql(`UPDATE profiles SET is_platform_admin=false WHERE id='${id(11)}';`);
 assert.equal((await rpcResult('admin_manage_membership',memberArgs)).status,403);
 sql(`UPDATE profiles SET is_platform_admin=true WHERE id='${id(11)}';`);
 await conflict('admin_manage_membership',memberArgs,'MEMBERSHIP_CONFLICT');
 await conflict('admin_manage_membership',{...memberArgs,p_action:'change_role',p_expected_role:'yonetici',p_expected_version:id(9000)},'MEMBERSHIP_CONFLICT');
 sql(`UPDATE profiles SET is_platform_admin=false WHERE id='${id(11)}';`);
 assert.equal(sql(`SELECT role FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';`),'yonetici');
 checks.push('membership HTTP conflicts do not change role; admin gate preserved');
 const version=sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';`);
 const selectArgs={p_tenant_id:id(1),p_membership_version:version,p_command_id:id(9001),p_expected_version:null};
 await conflict('select_workspace',{...selectArgs,p_membership_version:id(9000)},'WORKSPACE_MEMBERSHIP_CHANGED');
 // Seed a selection in the disposable DB to exercise both CAS branches deterministically.
 sql(`DELETE FROM workspace_selections WHERE user_id='${id(11)}';INSERT INTO workspace_selections(user_id,tenant_id,command_id) VALUES('${id(11)}','${id(1)}','${id(9002)}');`);
 await conflict('select_workspace',selectArgs,'WORKSPACE_SELECTION_CHANGED');
 sql(`UPDATE workspace_selections SET tenant_id='${id(2)}',command_id='${id(9001)}' WHERE user_id='${id(11)}';`);
 await conflict('select_workspace',selectArgs,'WORKSPACE_COMMAND_REUSED');
 sql(`DELETE FROM workspace_selections WHERE user_id='${id(11)}';`);
 const selected=await rpc('select_workspace',selectArgs);assert.equal(selected.tenantId,id(1));
 checks.push('three workspace HTTP conflicts terminate; valid selection succeeds');
 // A previously valid JWT must lose write authority after real membership/selection changes.
 const memberVersion=()=>sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';`);
 const scoped=(tenant,selection,membership)=>jwt('authenticated',11,tenant,{workspace_selection_version:selection,workspace_membership_version:membership});
 const beforeRole=scoped(1,selected.selectionVersion,memberVersion());
 assert.equal((await rpcResult('document_pending_uploads_v1',{p_tenant:id(1)},beforeRole)).status,200);
 const rolePreparation=await rpcResult('document_prepare_upload_v1',{...preparation,p_id:id(9205)},beforeRole);assert.equal(rolePreparation.status,200);
 assert.equal((await request('/object/documents/'+rolePreparation.data,'POST',pdf,beforeRole,{'Content-Type':'application/pdf'})).ok,true);

 sql(`UPDATE tenant_memberships SET role='goruntuleyici' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';`);
 assert.equal((await rpcResult('document_pending_uploads_v1',{p_tenant:id(1)},beforeRole)).status,403);
 const lowerRole=scoped(1,selected.selectionVersion,memberVersion());
 for(const [name,args] of [
  ['document_pending_uploads_v1',{p_tenant:id(1)}],
  ['document_prepare_upload_v1',{...preparation,p_id:id(9201)}],
  ['document_finalize_upload_v1',{p_tenant:id(1),p_id:id(9205)}],
  ['document_cancel_upload_v1',{p_tenant:id(1),p_id:id(9205)}]
 ])assert.equal((await rpcResult(name,args,lowerRole)).status,403,name);
 sql(`UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${id(11)}' AND tenant_id='${id(1)}';`);
 checks.push('stale role token and current read-only role cannot list or write uploads');
 const freshA=scoped(1,selected.selectionVersion,memberVersion());
 assert.equal(sql(`SELECT published_at IS NULL FROM document_upload_attempts WHERE document_id='${id(9205)}';`),'t');
 assert.equal(sql(`SELECT count(*) FROM document_cleanup_jobs WHERE document_id='${id(9205)}';`),'0');
 assert.equal((await rpcResult('document_cancel_upload_v1',{p_tenant:id(1),p_id:id(9205)},freshA)).status,200);

 sql(`INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('${id(11)}','${id(2)}','yonetici');`);
 const memberB=sql(`SELECT version FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(2)}';`);
 // Hold an actual HTTP request body open across the workspace switch.
 const streamingId=id(9403);
 const streamingPrep=await rpcResult('document_prepare_upload_v1',{...preparation,p_id:streamingId},freshA);
 assert.equal(streamingPrep.status,200);
 const streamingPath=streamingPrep.data;
 let streamRequest,streamStarted;
 const firstChunk=new Promise(resolve=>{streamStarted=resolve;});
 const streamResult=new Promise((resolve,reject)=>{
  streamRequest=http.request(new URL(base+'/object/documents/'+streamingPath),{method:'POST',headers:{Authorization:'Bearer '+freshA,'Content-Type':'application/pdf','Content-Length':pdf.length}},response=>{
   response.resume();response.on('end',()=>resolve(response.statusCode));response.on('error',reject);
  });
  streamRequest.on('error',reject);
  streamRequest.setTimeout(10000,()=>streamRequest.destroy(Error('Local streamed upload deadline')));
  streamRequest.write(pdf.subarray(0,5),()=>streamStarted());
 });
 // Attach a rejection handler immediately; the outcome is asserted below.
 const streamOutcome=streamResult.then(status=>({status}),error=>({error:error.message}));
 await firstChunk;
 const workspaceMoved=await rpcResult('select_workspace',{p_tenant_id:id(2),p_membership_version:memberB,p_command_id:id(9202),p_expected_version:selected.selectionVersion},freshA);
 assert.equal(workspaceMoved.status,200);const freshB=scoped(2,workspaceMoved.data.selectionVersion,memberB);
 streamRequest.end(pdf.subarray(5));
 const streamed=await streamOutcome;
 assert.equal(streamed.error,undefined);assert.ok(streamed.status>=400,`stale streamed upload status ${streamed.status}`);
 assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${streamingPath}';`),'0');
 for(const auth of [freshA,freshB]){
  assert.equal((await rpcResult('document_finalize_upload_v1',{p_tenant:id(1),p_id:streamingId},auth)).status,403);
  assert.equal((await request('/object/authenticated/documents/'+streamingPath,'GET',undefined,auth)).ok,false);
 }
 assert.equal(sql(`SELECT count(*) FROM documents WHERE id='${streamingId}';`),'0');
 checks.push('workspace switch while HTTP body is incomplete rejects old upload and finalize; no cross-tenant read');

 for(const auth of [freshA,freshB]){
  assert.equal((await rpcResult('document_pending_uploads_v1',{p_tenant:id(1)},auth)).status,403);
  assert.equal((await rpcResult('document_prepare_upload_v1',{...preparation,p_id:id(9203)},auth)).status,403);
 }
 assert.equal((await rpcResult('document_pending_uploads_v1',{p_tenant:id(2)},freshB)).status,200);
 const returned=await rpcResult('select_workspace',{p_tenant_id:id(1),p_membership_version:memberVersion(),p_command_id:id(9204),p_expected_version:workspaceMoved.data.selectionVersion},freshB);
 assert.equal(returned.status,200);
 sql(`DELETE FROM tenant_memberships WHERE user_id='${id(11)}' AND tenant_id='${id(2)}';`);
 assert.equal(sql(`SELECT count(*) FROM document_upload_attempts WHERE document_id IN ('${id(9201)}','${id(9203)}');`),'0');
 checks.push('A-to-B switch denies stale A token and B access to A uploads; no rejected writes persist');


 if(process.env.BPS_RELEASE_BARRIER==='1'){
  const current=scoped(1,returned.data.selectionVersion,memberVersion());
  const reserve=async n=>{const r=await rpcResult('document_prepare_upload_v1',{...preparation,p_id:id(n)},current);assert.equal(r.status,200);return r.data;};
  const blockedPath=await reserve(9301),deletePath=await reserve(9302);
  assert.ok((await request('/object/documents/'+deletePath,'POST',pdf,current,{'Content-Type':'application/pdf'})).ok);
  assert.equal((await rpcResult('document_cancel_upload_v1',{p_tenant:id(1),p_id:id(9302)},current)).status,200);
  const barrierSql=name=>readFileSync(new URL('../release-chain-20261016/barrier/'+name+'.sql',import.meta.url),'utf8');
  docker(['exec','-i','-e',`PGPASSWORD=${password}`,source,'psql','-w','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],barrierSql('install'));
  sql(barrierSql('verify'));
  const deniedPrepare=await rpcResult('document_prepare_upload_v1',{...preparation,p_id:id(9303)},current);
  assert.equal(deniedPrepare.status,503);assert.equal(deniedPrepare.data.code,'PT503');
  const deniedUpload=await request('/object/documents/'+blockedPath,'POST',pdf,current,{'Content-Type':'application/pdf'});
  assert.equal(deniedUpload.ok,false);
  assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${blockedPath}'`),'0');
  const deniedDelete=await request('/object/documents','DELETE',JSON.stringify({prefixes:[deletePath]}),current,{'Content-Type':'application/json'});
  assert.equal(deniedDelete.ok,false);
  const retained=await request('/object/authenticated/documents/'+deletePath,'GET',undefined,current);
  assert.ok(retained.ok);assert.equal(retained.text,pdf.toString());
  docker(['exec','-i','-e',`PGPASSWORD=${password}`,source,'psql','-w','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],barrierSql('remove'));
  assert.ok((await request('/object/documents/'+blockedPath,'POST',pdf,current,{'Content-Type':'application/pdf'})).ok);
  assert.ok((await request('/object/documents','DELETE',JSON.stringify({prefixes:[deletePath]}),current,{'Content-Type':'application/json'})).ok);
  const evidence={rpcStatus:deniedPrepare.status,uploadStatus:deniedUpload.status,deleteStatus:deniedDelete.status,retainedBytes:true,reopenedUploadAndDelete:true,scope:'local Storage HTTP; no production writes'};
  const {writeFileSync}=await import('node:fs');writeFileSync(new URL('../release-chain-20261016/barrier/http-result.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');
  checks.push('release barrier rejects HTTP RPC/upload/delete; bytes survive; reopening works');
 }
 if(process.env.BPS_LOCAL_BROWSER==='1')await (await import('./authenticated-browser.mjs')).serve({docker,sql,run,source,network,database,password,secret,anon,service,rest,restBase,storageBase:base,id,pdf});
 console.log(JSON.stringify({passed:checks.length,checks,scope:'isolated local Storage HTTP and cloned synthetic DB'},null,2));
} catch(e){console.error(redact(e.message));try{console.error(redact(logs()).slice(-6500));}catch{}process.exitCode=1;}
finally {
 for(const name of [storage,rest])try{docker(['rm','-f',name]);}catch{}
 if(created)sql(`DROP DATABASE ${database} WITH (FORCE);`,'postgres');
 for(const name of [storage,rest])assert.equal(docker(['ps','-a','--filter',`name=^/${name}$`,'--format','{{.Names}}']),'','Temporary container remained');
}
