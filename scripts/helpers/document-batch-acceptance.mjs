import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function checkDocumentBatch({page,sql,user,tenant,prefix,origin}) {
 const own=`created_by='${user}' AND name LIKE '${prefix}-document-batch-%'`,excluded=randomUUID();
 try {
  sql(`INSERT INTO companies(id,tenant_id,name,status,created_by) SELECT gen_random_uuid(),'${tenant}','${prefix}-document-batch-'||n,'aday','${user}' FROM generate_series(1,1005) n`);
  const ids=JSON.parse(sql(`SELECT json_agg(id ORDER BY id) FROM companies WHERE ${own}`));
  sql(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,created_by,updated_at) SELECT gen_random_uuid(),id,tenant_id,'${prefix}-batch-document-'||id,'diger','tam','${user}','2026-01-01'::timestamptz FROM companies WHERE ${own};
   INSERT INTO documents(id,company_id,tenant_id,name,category,status,created_by,updated_at) SELECT gen_random_uuid(),'${ids[0]}','${tenant}','${prefix}-batch-bulk-'||n,'diger','tam','${user}','2026-01-01'::timestamptz FROM generate_series(1,1004) n;
   INSERT INTO documents(id,company_id,tenant_id,name,category,status,created_by,updated_at) VALUES(gen_random_uuid(),'${ids[0]}','${tenant}','${prefix}-oldest','diger','eksik','${user}','2000-01-01'),(gen_random_uuid(),'${ids.at(-1)}','${tenant}','${prefix}-newest','diger','tam','${user}','2050-01-01');
   INSERT INTO companies(id,tenant_id,name,status,created_by) VALUES('${excluded}','${tenant}','${prefix}-document-batch-excluded','aday','${user}');INSERT INTO documents(id,company_id,tenant_id,name,category,status,created_by) VALUES(gen_random_uuid(),'${excluded}','${tenant}','${prefix}-excluded','diger','tam','${user}')`);
  const input=page.getByLabel('Test evrak firma kimlikleri',{exact:true}),button=page.getByRole('button',{name:'Evrakları oku',exact:true}),result=page.getByTestId('document-batch-result'),pattern='**/rest/v1/documents?*';
  const urls=[],statuses=[],failed=[];const watch=r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/rest/v1/documents')urls.push(r.url());};const response=r=>{if(r.request().method()==='GET'&&new URL(r.url()).pathname==='/rest/v1/documents')statuses.push(r.status());};const fail=r=>{if(new URL(r.url()).pathname==='/rest/v1/documents')failed.push(r.url());};page.on('request',watch);page.on('response',response);page.on('requestfailed',fail);
  const start=async keys=>{await input.fill(JSON.stringify(keys));await button.click();};
  const read=async()=>{await result.filter({hasText:/^\{/}).waitFor();return JSON.parse(await result.textContent());};
  await page.goto(origin+'/qa-document-batch');
  if(process.env.BPS_DOCUMENT_BATCH_REPRO==='1'){await start(ids);await result.filter({hasText:'error'}).waitFor();assert.ok(urls.some(u=>u.length>30000));assert.ok(failed.length>0||statuses.some(n=>n>=400));console.log('REPRO confirmed: 1005-company document scope exceeds 30000 URL characters and fails instead of loading');return;}
  const verify=async()=>{const r=await read();assert.equal(r.count,2011);assert.equal(r.unique,2011);assert.equal(Object.keys(r.companies).length,1005);assert.equal(r.companies[ids[0]],1006);assert.equal(r.companies[ids.at(-1)],2);assert.ok(!Object.hasOwn(r.companies,excluded));assert.equal(r.first,prefix+'-newest');assert.equal(r.last,prefix+'-oldest');return r;};
  await start([...ids,ids[0]]);await verify();assert.ok(urls.length>30);for(const url of urls){assert.ok(url.length<4000);const p=new URL(url).searchParams,scope=p.get('company_id');const requested=scope.startsWith('eq.')?[scope.slice(3)]:scope.slice(4,-1).split(',');assert.ok(requested.length>0&&requested.length<=60);assert.ok(requested.every(id=>ids.includes(id)));assert.equal(p.get('order'),'id.asc');}
  urls.length=0;await start([]);assert.equal((await read()).count,0);assert.equal(urls.length,0);
  let starts=0;const bad=async route=>{const p=new URL(route.request().url()).searchParams;if(route.request().method()==='GET'&&!p.has('id')&&++starts===2)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic document batch failure"}'});await route.fallback();};
  await page.route(pattern,bad);await start(ids);await result.filter({hasText:'error'}).waitFor();assert.equal(await result.textContent(),'error');await page.unroute(pattern,bad);await start(ids);await verify();
  page.off('request',watch);page.off('response',response);page.off('requestfailed',fail);
  console.log('PASS 2011 documents across 1005 scoped companies, multi-page first group, duplicate IDs, excluded company, global newest/oldest ordering, empty/no GET, bounded URLs and later-batch failure/retry');
 } finally {sql(`DELETE FROM companies WHERE ${own}`);}
}
