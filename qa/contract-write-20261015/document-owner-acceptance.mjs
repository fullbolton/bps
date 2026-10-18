import assert from 'node:assert/strict';
// Called before workspace-switch tests, only in their disposable synthetic database.
export async function acceptDocumentOwners({sql,id,jwt,rpcResult,request,pdf,preparation}){
 const checks=[];
 const a=id(11),b=id(12),tenant=id(1),first=id(9801),second=id(9802);
 assert.equal(sql(`SELECT count(*) FROM tenant_memberships WHERE user_id='${b}' AND tenant_id='${tenant}'`),'0');
 assert.equal(sql(`SELECT count(*) FROM workspace_selections WHERE user_id IN ('${a}','${b}')`),'0');
 const token=(user)=>user===12?jwt('authenticated',12,1,{workspace_selection_version:sql(`SELECT version FROM workspace_selections WHERE user_id='${b}'`),workspace_membership_version:sql(`SELECT version FROM tenant_memberships WHERE user_id='${b}' AND tenant_id='${tenant}'`)}):jwt('authenticated',user,1);
 const scope={p_tenant:tenant};
 const invoke=async(name,args,auth)=>{const r=await rpcResult(name,args,auth);assert.ok(r.ok,`${name}: ${r.status} ${JSON.stringify(r.data)}`);return r.data;};
 try{
  sql(`INSERT INTO tenant_memberships(user_id,tenant_id,role) VALUES('${b}','${tenant}','operasyon');INSERT INTO workspace_selections(user_id,tenant_id,command_id) VALUES('${b}','${tenant}','${id(9800)}');`);
  const path=await invoke('document_prepare_upload_v1',{...preparation,p_id:first},token(12));
  assert.ok((await request('/object/documents/'+path,'POST',pdf,token(12),{'Content-Type':'application/pdf'})).ok);
  const managerRows=await invoke('document_pending_uploads_v1',scope,token(11));
  assert.equal(managerRows.find(r=>r.document_id===first)?.can_resume,false);
  for(const name of ['document_upload_recovery_target_v1','document_finalize_upload_v1','document_cancel_upload_v1'])
   assert.equal((await rpcResult(name,{...scope,p_id:first},token(11))).status,403,name);
  checks.push('manager sees colleague pending upload but cannot recover finalize or cancel it');
  for(const role of ['operasyon','ik']){
   sql(`UPDATE tenant_memberships SET role='${role}' WHERE user_id='${a}' AND tenant_id='${tenant}';`);
   const rows=await invoke('document_pending_uploads_v1',scope,token(11));
   assert.equal(rows.some(r=>r.document_id===first),false);
   for(const name of ['document_upload_recovery_target_v1','document_finalize_upload_v1','document_cancel_upload_v1'])
    assert.equal((await rpcResult(name,{...scope,p_id:first},token(11))).status,403,name);
   checks.push(`${role} cannot list or mutate colleague pending upload in same tenant`);
  }
  const ownPath=await invoke('document_prepare_upload_v1',{...preparation,p_id:second},token(11));
  assert.ok((await request('/object/documents/'+ownPath,'POST',pdf,token(11),{'Content-Type':'application/pdf'})).ok);
  assert.equal(await invoke('document_finalize_upload_v1',{...scope,p_id:second},token(11)),second);
  checks.push('HR can prepare upload and finalize own document through HTTP');
  sql(`UPDATE tenant_memberships SET role='muhasebe' WHERE user_id='${a}' AND tenant_id='${tenant}';`);
  for(const [name,args] of [
   ['document_pending_uploads_v1',scope],['document_prepare_upload_v1',{...preparation,p_id:id(9803)}],
   ['document_upload_recovery_target_v1',{...scope,p_id:first}],['document_finalize_upload_v1',{...scope,p_id:first}],['document_cancel_upload_v1',{...scope,p_id:first}]
  ])assert.equal((await rpcResult(name,args,token(11))).status,403,name);
  assert.equal(sql(`SELECT count(*) FROM document_upload_attempts WHERE document_id='${id(9803)}'`),'0');
  checks.push('accounting cannot list prepare recover finalize or cancel; rejected preparation leaves no row');
  assert.equal(sql(`SELECT published_at IS NULL FROM document_upload_attempts WHERE document_id='${first}'`),'t');
  assert.equal(sql(`SELECT count(*) FROM document_cleanup_jobs WHERE document_id='${first}'`),'0');
  const bytes=await request('/object/authenticated/documents/'+path,'GET',undefined,token(12));
  assert.ok(bytes.ok);assert.equal(bytes.text,pdf.toString());
  checks.push('denied colleague operations preserve original pending row and file bytes');
  assert.equal(await invoke('document_finalize_upload_v1',{...scope,p_id:first},token(12)),first);
  checks.push('original uploader still finalizes after all denied cross-user operations');
 }finally{
  sql(`UPDATE tenant_memberships SET role='yonetici' WHERE user_id='${a}' AND tenant_id='${tenant}';DELETE FROM workspace_selections WHERE user_id='${b}';DELETE FROM tenant_memberships WHERE user_id='${b}' AND tenant_id='${tenant}';`);
 }
 return checks;
}
