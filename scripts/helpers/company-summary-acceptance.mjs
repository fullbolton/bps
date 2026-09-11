import assert from 'node:assert/strict';
export async function checkCompanySummaries({page,sql,user,tenant,prefix,origin,output}) {
 const own=`created_by='${user}' AND name LIKE '${prefix}-summary-%'`;
 try {
  sql(`INSERT INTO companies(id,tenant_id,name,status,created_by) SELECT gen_random_uuid(),'${tenant}','${prefix}-summary-'||n,'aday','${user}' FROM generate_series(1,1005) n`);
  const rows=JSON.parse(sql(`SELECT json_agg(json_build_object('id',id,'name',name) ORDER BY id) FROM companies WHERE ${own}`)),first=rows[0],last=rows.at(-1);
  sql(`INSERT INTO contacts(id,tenant_id,company_id,full_name,is_primary,created_by) SELECT gen_random_uuid(),tenant_id,id,'Primary '||name,true,'${user}' FROM companies WHERE ${own};
   INSERT INTO contacts(id,tenant_id,company_id,full_name,is_primary,created_by) VALUES(gen_random_uuid(),'${tenant}','${last.id}','Excluded secondary',false,'${user}');
   INSERT INTO contracts(id,tenant_id,company_id,name,status,start_date,end_date,created_by) SELECT gen_random_uuid(),'${tenant}','${first.id}','${prefix}-summary-contract-'||n,'aktif','2026-09-01','2027-09-01','${user}' FROM generate_series(1,1005) n;
   INSERT INTO contracts(id,tenant_id,company_id,name,status,start_date,end_date,created_by) VALUES(gen_random_uuid(),'${tenant}','${last.id}','${prefix}-summary-last','aktif','2026-09-01','2027-09-01','${user}'),(gen_random_uuid(),'${tenant}','${first.id}','${prefix}-summary-draft','taslak',NULL,NULL,'${user}')`);
  const urls=[],watch=r=>{const u=new URL(r.url());if(r.method()==='GET'&&['/rest/v1/contacts','/rest/v1/contracts'].includes(u.pathname))urls.push(r.url());};page.on('request',watch);
  const search=page.getByRole('textbox',{name:'Firma, yetkili, sektor ara...',exact:true});
  const rowFor=company=>page.getByRole('row').filter({has:page.getByRole('cell',{name:company.name,exact:true})});
  const warning=page.getByText('Firma listesi yüklendi; bazı yetkili veya sözleşme özetleri okunamadı.',{exact:true});
  const verify=async(company,count)=>{await search.fill(company.name);const row=rowFor(company);await row.getByRole('cell',{name:'Primary '+company.name,exact:true}).waitFor();await row.getByRole('cell',{name:String(count),exact:true}).waitFor();assert.equal(await warning.count(),0);};
  await page.goto(origin+'/firmalar');await verify(first,1005);await verify(last,1);
  assert.ok(urls.length>30);for(const url of urls){assert.ok(url.length<4000);const u=new URL(url);assert.match(u.searchParams.get('company_id'),/^in\./);assert.equal(u.searchParams.get(u.pathname.endsWith('/contacts')?'is_primary':'status'),u.pathname.endsWith('/contacts')?'eq.true':'eq.aktif');assert.equal(u.searchParams.get('order'),'id.asc');}
  // A second contract page fails: no partial count, but the contact summary survives.
  const contractPattern='**/rest/v1/contracts?*';let contractHit=false;
  const badContract=async r=>{if(r.request().method()==='GET'&&new URL(r.request().url()).searchParams.get('id')?.startsWith('gt.')){contractHit=true;return r.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic contract page failure"}'});}await r.fallback();};
  await verify(first,1005);await page.route(contractPattern,badContract);await page.reload();await warning.waitFor();assert.ok(contractHit);await rowFor(first).getByRole('cell',{name:'Primary '+first.name,exact:true}).waitFor();assert.equal(await rowFor(first).getByRole('cell',{name:'Okunamadı',exact:true}).count(),1);assert.equal(await rowFor(first).getByRole('cell',{name:'1005',exact:true}).count(),0);
  await page.unroute(contractPattern,badContract);await page.getByRole('button',{name:'Özetleri yeniden dene',exact:true}).click();await verify(first,1005);
  // A later contact batch fails: all contact names are unknown, contract counts survive.
  const contactPattern='**/rest/v1/contacts?*';let starts=0;
  const badContact=async r=>{const p=new URL(r.request().url()).searchParams;if(r.request().method()==='GET'&&!p.has('id')&&++starts===2)return r.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic contact batch failure"}'});await r.fallback();};
  await page.route(contactPattern,badContact);await page.reload();await warning.waitFor();await rowFor(first).getByRole('cell',{name:'1005',exact:true}).waitFor();assert.equal(await rowFor(first).getByRole('cell',{name:'Okunamadı',exact:true}).count(),1);assert.equal(await rowFor(first).getByRole('cell',{name:'Primary '+first.name,exact:true}).count(),0);await page.screenshot({path:output+'/company-summary-partial-error.png'});
  await page.unroute(contactPattern,badContact);await page.getByRole('button',{name:'Özetleri yeniden dene',exact:true}).click();await verify(first,1005);await verify(last,1);
  await page.screenshot({path:output+'/company-summary-complete.png'});page.off('request',watch);
  console.log('PASS summaries across 1005 owned companies: primary names, 1005 active contracts in one company, secondary/draft exclusion, scoped URLs under 4000, independent later-page/batch errors and retry');
 } finally {sql(`DELETE FROM companies WHERE ${own}`);}
}
