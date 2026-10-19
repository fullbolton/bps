import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {importActualTypeScript} from '../../scripts/helpers/import-typescript.mjs';
const {enqueueHrDocumentUpload,actOnHrDocumentScan}=await importActualTypeScript(new URL('../../src/lib/services/hr-document-scan.ts',import.meta.url));
export async function accept({sql,rpcResult,request,id,jwt,service,docker,storage,rest,network}){
 const actor=id(11),tenant=id(1),suffix=process.pid,daemon=`bps-clam-combined-${suffix}`,volume=`bps-clam-combined-${suffix}`,sidecar=`bps-clam-job-${suffix}`;
 const root=fileURLToPath(new URL('../../',import.meta.url)),evidence=fileURLToPath(new URL('./',import.meta.url));
 sql(`UPDATE profiles SET role='yonetici' WHERE id='${actor}';UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${actor}' AND tenant_id='${tenant}';ALTER TABLE tenant_module_settings DISABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${tenant}' AND module_key='hr';ALTER TABLE tenant_module_settings ENABLE TRIGGER tenant_module_key_guard_v1;UPDATE tenant_module_entitlements SET granted=true WHERE tenant_id='${tenant}' AND module_key='hr'`);
 const token=jwt('authenticated',11,1,{workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${actor}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${actor}' AND tenant_id='${tenant}'`)});
 const rpc=async(n,a)=>{const r=await rpcResult(n,a,token);assert.ok(r.ok,n+': '+JSON.stringify(r.data));return r.data;};
 const employee=(await rpc('hr_create_record_v1',{p_actor:actor,p_tenant:tenant,p_command:id(9600),p_payload:{kind:'employee',name:'Synthetic malware acceptance',code:'MALWARE-HTTP',startsOn:'2026-01-01'}})).id;
 const client={rpc:(name,args)=>({abortSignal:async()=>{const r=await rpcResult(name,args,token);return {data:r.data,error:r.ok?null:Error('RPC_FAILED')};}}),storage:{from:()=>({upload:async(path,bytes)=>{const r=await request('/object/hr-private/'+path,'POST',Buffer.from(bytes),token,{'Content-Type':'application/pdf','x-upsert':'false'});return {error:r.ok?null:Error('UPLOAD_FAILED')};}})}};
 const context={actor,tenant,employee};
 const employment=sql(`SELECT id FROM hr_employment_periods WHERE employee_id='${employee}'`),checks=[];
 docker(['volume','create',volume]);
 try{
  docker(['run','-d','--name',daemon,'--platform','linux/amd64','--network','none','--memory','2500m','-e','TZ=UTC','--entrypoint','clamd','-v','bps-clam-signatures-20261020:/var/lib/clamav:ro','-v',`${volume}:/run/bps-clam`,'-v',`${evidence}clamd.conf:/qa/clamd.conf:ro`,'clamav/clamav@sha256:e19130cdebaeacc71fa46eab3ed6f69941f2f22aa5e08d55e9197f8edf43ce5e','--config-file=/qa/clamd.conf']);
  let ready=false;for(let i=0;i<60;i++){if(docker(['logs',daemon]).includes('Self checking every')){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert.ok(ready,'daemon readiness');
  for(const [index,file,verdict] of [[9601,'clean.pdf','clean'],[9602,'encrypted.pdf','infected'],[9603,'limit.pdf','infected']]){
   const bytes=readFileSync('/tmp/bps-clam-fixtures-20261020/'+file),sha=createHash('sha256').update(bytes).digest('hex'),upload=id(index),path=`${tenant}/${upload}.pdf`,args={p_actor:actor,p_tenant:tenant,p_upload:upload};
   const input={id:upload,employmentId:employment,title:'Synthetic '+file,size:bytes.length,sha256:sha,validityDate:null};
   assert.equal((await enqueueHrDocumentUpload(client,context,input,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))).state,'pending');
   assert.equal((await actOnHrDocumentScan(client,context,input,'status')).scan.status,'queued');
   assert.equal((await request('/object/authenticated/hr-private/'+path,'GET',undefined,token)).ok,false,'quarantined bytes must not be readable');
   assert.equal((await rpcResult('hr_document_finish_v1',args,token)).ok,false,'unscanned finalize');
   await assert.rejects(actOnHrDocumentScan(client,context,input,'finalize'));
   const env={WORKER:id(9650),ACTOR:actor,TENANT:tenant,UPLOAD:upload,SERVICE_TOKEN:service,STORAGE:`http://${storage}:5000`,REST:`http://${rest}:3000`};
   const result=JSON.parse(docker(['run','--rm','--name',sidecar,'--pid=container:'+daemon,'--network',network,'--entrypoint','node','-v',`${volume}:/run/bps-clam`,'-v',`${root}workers/hr-malware:/worker:ro`,'-v',`${evidence}:/evidence:ro`,...Object.entries(env).flatMap(([k,v])=>['-e',`${k}=${v}`]),'public.ecr.aws/supabase/storage-api@sha256:5a3ecdc67dbe9e88a56810b5b2f432f2d93708dcb4dc9de34e78e342b390eb4d','/evidence/storage-runner.mjs']));
   assert.equal(sql(`SELECT state FROM hr_malware_jobs WHERE upload_id='${upload}'`),verdict==='clean'?'complete':'blocked');
   assert.equal(result.verdict,verdict);assert.equal(result.sha256,sha);assert.equal(sql(`SELECT verdict FROM hr_malware_scans WHERE upload_id='${upload}'`),verdict);
   assert.equal((await actOnHrDocumentScan(client,context,input,'status')).scan.status,verdict==='clean'?'ready':'blocked');
   const finished={ok:false};if(verdict==='clean'){assert.equal((await actOnHrDocumentScan(client,context,input,'finalize')).receipt.state,'published');finished.ok=true;}else await assert.rejects(actOnHrDocumentScan(client,context,input,'finalize'));
   const readable=await request('/object/authenticated/hr-private/'+path,'GET',undefined,token);assert.equal(readable.ok,verdict==='clean');
   if(verdict==='clean'){await rpc('hr_document_finish_v1',args);assert.equal(sql(`SELECT count(*) FROM hr_private_documents WHERE id='${upload}'`),'1');}
   else {assert.equal(sql(`SELECT state FROM hr_document_uploads WHERE id='${upload}'`),'pending');assert.equal((await rpc('hr_document_shutdown_preflight_v1',{p_actor:actor,p_tenant:tenant})).blocking,true);}
   checks.push({file,verdict,quarantineBeforeScan:true,published:finished.ok,readableAfterScan:readable.ok});
  }
  writeFileSync(new URL('./storage-result.json',import.meta.url),JSON.stringify({realStorageHttp:true,realPostgrest:true,realDatabase:true,realClamav:true,realWorkerAdapters:true,realApplicationService:true,nextRouteTested:false,leasedExecution:true,userJwtPassedToWorker:false,syntheticOnly:true,productionReady:false,checks},null,2)+'\n');return ['Real Storage → measured ClamAV → guarded report → finalize: clean publishes once; encrypted/limit stay quarantined and block closure'];
 }finally{for(const name of [sidecar,daemon])try{docker(['rm','-f',name]);}catch{}docker(['volume','rm',volume]);}
}
