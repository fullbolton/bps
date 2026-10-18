import assert from 'node:assert/strict';
import http from 'node:http';
import {writeFileSync} from 'node:fs';

// Only invoked by the disposable local Storage harness, before workspace changes.
export async function acceptUploadInterruption({base,token,rpc,rpcResult,request,sql,id,preparation,pdf}) {
 const url=new URL(base);assert.equal(url.hostname,'127.0.0.1');
 const scope={p_tenant:id(1),p_id:id(9701)};
 const path=await rpc('document_prepare_upload_v1',{...preparation,p_id:scope.p_id});
 const prefix=pdf.subarray(0,12);
 await new Promise((resolve,reject)=>{
  let aborted=false;
  const req=http.request(new URL('/object/documents/'+path,base),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/pdf','Content-Length':pdf.length,'x-upsert':'false'}});
  const deadline=setTimeout(()=>{req.destroy();reject(Error('Partial upload did not reach write callback'));},10000);
  req.on('response',res=>{res.resume();clearTimeout(deadline);reject(Error('Storage responded before body interruption: '+res.statusCode));});
  req.on('error',error=>{if(!aborted){clearTimeout(deadline);reject(error);}});
  req.write(prefix,()=>setTimeout(()=>{aborted=true;clearTimeout(deadline);req.destroy();resolve();},500));
 });
 // Let the local server observe socket closure. No write is retried here.
 await new Promise(resolve=>setTimeout(resolve,1000));
 assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${path}'`),'0');
 const denied=await rpcResult('document_finalize_upload_v1',scope);
 assert.equal(denied.ok,false);
 assert.equal(sql(`SELECT count(*) FROM documents WHERE id='${scope.p_id}'`),'0');
 const pending=await rpc('document_pending_uploads_v1',{p_tenant:id(1),p_offset:0});
 assert.equal(pending.find(row=>row.document_id===scope.p_id)?.file_present,false);
 assert.equal(sql(`SELECT published_at IS NULL FROM document_upload_attempts WHERE document_id='${scope.p_id}'`),'t');
 const retry=await request('/object/documents/'+path,'POST',pdf,token,{'Content-Type':'application/pdf','x-upsert':'false'});
 assert.ok(retry.ok,`Complete retry failed: ${retry.status}`);
 const bytes=await request('/object/authenticated/documents/'+path);
 assert.ok(bytes.ok);assert.equal(bytes.text,pdf.toString());
 assert.equal(await rpc('document_finalize_upload_v1',scope),scope.p_id);
 assert.equal(await rpc('document_finalize_upload_v1',scope),scope.p_id);
 assert.equal(sql(`SELECT count(*) FROM documents WHERE id='${scope.p_id}'`),'1');
 const checks=['partial HTTP body leaves no registered object or document and finalize is rejected','reservation survives interruption with file_present=false','complete same-path retry preserves bytes and publishes exactly once'];
 writeFileSync(new URL('./upload-body-interruption-result.json',import.meta.url),JSON.stringify({passed:checks.length,checks,advertisedBytes:pdf.length,sentBytes:prefix.length,finalizeRejectedStatus:denied.status,scope:'disposable local Storage HTTP; client socket aborted before complete body; not browser or physical mobile'},null,2)+'\n');
 return checks;
}
