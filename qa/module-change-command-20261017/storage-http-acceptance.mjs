import assert from 'node:assert/strict';

// Runs only inside the disposable Storage harness, before its workspace switches.
// Reservation rows are synthetic fixtures; this tests Storage HTTP, not reserve/finalize RPCs.
export async function acceptModuleStorage({sql,request,id,pdf,token,foreign,anon}) {
 const checks=[];
 sql(`INSERT INTO storage.buckets(id,name,public) VALUES('person-files','person-files',false),('project-sources','project-sources',false) ON CONFLICT DO NOTHING;
 INSERT INTO talent_people(id,tenant_id,name,source) VALUES('${id(9851)}','${id(1)}','Synthetic HTTP policy','manual');
 INSERT INTO talent_attachments(id,tenant_id,person_id,actor_id,category,filename,mime,size,sha256)
 SELECT v,'${id(1)}','${id(9851)}','${id(11)}','cv','synthetic.pdf','application/pdf',${pdf.length},repeat('a',64) FROM unnest(ARRAY['${id(9852)}'::uuid,'${id(9853)}'::uuid]) v;
 INSERT INTO companies(id,tenant_id,name) VALUES('${id(9854)}','${id(1)}','Synthetic source HTTP');
 INSERT INTO reporting_projects(tenant_id,id,company_id,code,name,kind,created_by) VALUES('${id(1)}','${id(9855)}','${id(9854)}','HTTP_QA','Synthetic HTTP','other','${id(11)}');
 INSERT INTO reporting_periods(tenant_id,project_id,month,created_by) VALUES('${id(1)}','${id(9855)}','2026-10-01','${id(11)}');
 INSERT INTO reporting_imports(tenant_id,id,project_id,month,actor_id,command_id,source,rows,resolved,base_revision) VALUES('${id(1)}','${id(9856)}','${id(9855)}','2026-10-01','${id(11)}','${id(9857)}','synthetic','[]','[]',1);`);
 for(const [bucket,module,path,pending,bytes,mime] of [
  ['person-files','talent',id(9852),id(9853),pdf,'application/pdf'],
  ['project-sources','reporting',`${id(1)}/${id(9856)}/${'a'.repeat(64)}.csv`,`${id(1)}/${id(9856)}/${'b'.repeat(64)}.csv`,Buffer.from('code,minutes\nsynthetic,60\n'),'text/csv'],
 ]) {
  const upload=(name,auth=token)=>request(`/object/${bucket}/${name}`,'POST',bytes,auth,{'Content-Type':mime,'x-upsert':'false'});
  const download=auth=>request(`/object/authenticated/${bucket}/${path}`,'GET',undefined,auth);
  const first=await upload(path);assert.ok(first.ok,`${bucket} upload: ${first.status} ${first.text}`);
  assert.equal(sql(`SELECT owner_id FROM storage.objects WHERE bucket_id='${bucket}' AND name='${path}'`),id(11));
  checks.push(`${bucket}: authenticated HTTP upload records caller ownership`);
  if(module==='talent')sql(`UPDATE talent_attachments SET ready=true WHERE id='${id(9852)}'`);
  const opened=await download(token);assert.ok(opened.ok);assert.equal(opened.text,bytes.toString());
  checks.push(`${bucket}: authenticated download preserves exact synthetic bytes`);
  for(const auth of [foreign,anon]){
   assert.equal((await download(auth)).ok,false);
   assert.equal((await upload(pending,auth)).ok,false);
  }
  checks.push(`${bucket}: foreign and anonymous read/upload denied`);
  sql(`UPDATE tenant_module_settings SET enabled=false WHERE tenant_id='${id(1)}' AND module_key='${module}'`);
  try{
   assert.equal((await download(token)).ok,false);
   assert.equal((await upload(pending)).ok,false);
   assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='${bucket}' AND name='${pending}'`),'0');
   checks.push(`${bucket}: closed module rejects HTTP read/upload without metadata`);
  }finally{sql(`UPDATE tenant_module_settings SET enabled=true WHERE tenant_id='${id(1)}' AND module_key='${module}'`);}
  const restored=await download(token);assert.ok(restored.ok);assert.equal(restored.text,bytes.toString());
  assert.ok((await upload(pending)).ok);
  checks.push(`${bucket}: reopening preserves original bytes and permits reserved upload`);
 }
 return checks;
}
