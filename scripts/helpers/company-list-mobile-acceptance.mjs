import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function checkCompanyListMobile({page,sql,user,tenant,prefix,origin,output}) {
 const company=randomUUID(),name=prefix+' Marmara Bölgesi Banka Şubeleri Personel ve Temizlik Hizmetleri '+ 'UzunFirmaUnvanı'.repeat(4),contact='Sentetik Bölge Operasyon Yetkilisi '+ 'UzunYetkiliAdı'.repeat(3);
 try {
  sql(`INSERT INTO companies(id,tenant_id,name,status,risk,city,sector,legacy_mock_id,created_by) VALUES('${company}','${tenant}','${name}','aday','orta','İstanbul','temizlik','${prefix}-mobile-legacy','${user}');INSERT INTO contacts(id,tenant_id,company_id,full_name,is_primary,created_by) VALUES(gen_random_uuid(),'${tenant}','${company}','${contact}',true,'${user}');INSERT INTO contracts(id,tenant_id,company_id,name,status,start_date,end_date,created_by) VALUES(gen_random_uuid(),'${tenant}','${company}','${prefix}-mobile-contract','aktif','2026-09-01','2027-09-01','${user}')`);
  await page.goto(origin+'/firmalar');
  const region=page.getByRole('region',{name:'Firma listesi',exact:true}),link=region.getByRole('link',{name,exact:true}),search=page.getByRole('textbox',{name:'Firma, yetkili, sektor ara...',exact:true});
  await search.fill(prefix);await link.waitFor();
  const filters=[['Durum','aday'],['Risk','orta'],['Sektor','temizlik'],['Sehir','İstanbul']];
  for(const [label,value] of filters)await page.getByLabel(label,{exact:true}).selectOption(value);
  await link.waitFor();const summary=link.locator('xpath=..').locator('dl');
  const overflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Page overflow');
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});await overflow();assert.equal(await region.getByRole('columnheader').count(),1);assert.equal(await region.getByRole('cell').count(),1);assert.equal(await region.getByRole('button',{name:'Detay',exact:true}).count(),0);
   assert.equal(await link.getAttribute('href'),'/firmalar/'+company);assert.ok(await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44&&r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth;}));
   await summary.getByText('İstanbul · Temizlik Hizmetleri',{exact:true}).waitFor();await summary.getByText(contact,{exact:true}).waitFor();await summary.getByText('1',{exact:true}).waitFor();assert.ok(await region.getByRole('cell').getByText('Aday',{exact:true}).isVisible());assert.ok(await region.getByText('Risk etiketi:',{exact:true}).isVisible());
   assert.ok(await region.locator('table').evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:output+'/company-list-'+width+'.png'});
  }
  await link.focus();await page.keyboard.press('Enter');await page.waitForURL(origin+'/firmalar/'+company);await page.getByRole('heading',{name,exact:true}).waitFor();await page.goBack();await link.waitFor();assert.equal(await search.inputValue(),prefix);for(const [label,value] of filters)assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),value);
  // Each mobile summary distinguishes failed reads from real absence/zero.
  for(const table of ['contacts','contracts']){
   const pattern='**/rest/v1/'+table+'?*';const failure=async route=>route.request().method()==='GET'?route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic mobile summary failure"}'}):route.fallback();
   await page.route(pattern,failure);await page.reload();await page.getByText('Firma listesi yüklendi; bazı yetkili veya sözleşme özetleri okunamadı.',{exact:true}).waitFor();await summary.getByText('Okunamadı',{exact:true}).waitFor();
   if(table==='contacts')await summary.getByText('1',{exact:true}).waitFor();else await summary.getByText(contact,{exact:true}).waitFor();
   await overflow();await page.screenshot({path:output+'/company-list-'+table+'-error-390.png'});await page.unroute(pattern,failure);await page.getByRole('button',{name:'Özetleri yeniden dene',exact:true}).click();await summary.getByText(contact,{exact:true}).waitFor();await summary.getByText('1',{exact:true}).waitFor();assert.equal(await summary.getByText('Okunamadı',{exact:true}).count(),0);assert.equal(await search.inputValue(),prefix);
  }
  await page.setViewportSize({width:1280,height:900});assert.equal(await region.getByRole('columnheader').count(),9);assert.ok(await summary.isHidden());await region.getByRole('cell',{name:contact,exact:true}).waitFor();await region.getByRole('cell',{name:'1',exact:true}).waitFor();assert.ok(await link.isVisible());assert.ok(await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.width>=200&&r.height<300;}));await page.screenshot({path:output+'/company-list-desktop.png'});
  await page.getByRole('button',{name:'Temizle',exact:true}).click();for(const [label] of filters)assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),'');
  console.log('PASS company list 320/390 mobile single-column summary, long names, 44px native UUID link, Enter/detail/back preferences, independent unknown summaries/retry and desktop columns');
 } finally {sql(`DELETE FROM companies WHERE id='${company}' AND created_by='${user}'`);await page.setViewportSize({width:1280,height:900});}
}
