import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkDocumentList({page, sql, user, tenant, first, prefix, origin, output}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 const ids=[randomUUID(),randomUUID()], title=prefix+'-İŞYERİ', other=prefix+'-other';
 sql(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,created_by) VALUES('${ids[0]}','${company}','${tenant}','${title}','diger','eksik','${user}'),('${ids[1]}','${company}','${tenant}','${other}','operasyon_evraki','tam','${user}')`);
 const path=origin+'/qa-document-scope', search=page.getByRole('textbox',{name:'Evrak, firma ara...',exact:true});
 const status=page.getByLabel('Durum',{exact:true}), category=page.getByLabel('Kategori',{exact:true}), firm=page.getByLabel('Firma',{exact:true});
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();await search.waitFor();};
 const verify=async()=>{await search.waitFor();assert.equal(await search.inputValue(),prefix+'-işyeri');assert.equal(await status.inputValue(),'eksik');assert.equal(await category.inputValue(),'diger');assert.equal(await firm.inputValue(),company);await page.getByRole('cell',{name:title,exact:true}).waitFor();assert.equal(await page.getByRole('cell',{name:other,exact:true}).count(),0);};
 await page.goto(path);await search.fill(prefix+'-işyeri');await status.selectOption('eksik');await category.selectOption('diger');await firm.selectOption(company);await page.getByRole('cell',{name:title,exact:true}).waitFor();await page.waitForTimeout(350);
 await page.reload();await verify();await page.goto(origin+'/dashboard');await page.goBack();await verify();
 await role('operasyon');assert.equal(await search.inputValue(),'');assert.equal(await status.inputValue(),'');await role('yonetici');await verify();
 await search.fill(prefix+'-missing');await page.getByRole('heading',{name:'Bu filtrelerle eşleşen evrak yok',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/document-list-empty-390.png'});
 await search.fill('pending debounce');await page.getByRole('button',{name:'Arama ve filtreleri temizle',exact:true}).click();assert.ok(await search.evaluate(e=>e===document.activeElement));await page.waitForTimeout(350);assert.equal(await search.inputValue(),'');assert.equal(await status.inputValue(),'');assert.equal(await category.inputValue(),'');assert.equal(await firm.inputValue(),'');await page.getByRole('cell',{name:other,exact:true}).waitFor();await page.reload();await search.waitFor();assert.equal(await search.inputValue(),'');
 // A saved company choice survives disappearance from the current visible document list.
 await firm.selectOption(company);const pattern='**/rest/v1/documents?*';let mode='missing';
 const route=async r=>{if(r.request().method()!=='GET')return r.fallback();if(mode==='error')return r.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic document list failure"}'});if(mode==='empty')return r.fulfill({status:200,contentType:'application/json',body:'[]'});const response=await r.fetch();const rows=await response.json();await r.fulfill({response,json:rows.filter(d=>d.company_id!==company)});};
 await page.route(pattern,route);await page.reload();await page.getByText('Kayıtlı seçim mevcut seçeneklerde yok. Seçimi değiştirin veya filtreleri temizleyin.',{exact:true}).waitFor();assert.equal(await firm.inputValue(),company);
 mode='error';await page.reload();await page.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Henüz evrak yok',exact:true}).count(),0);await page.unroute(pattern,route);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await firm.waitFor();assert.equal(await firm.inputValue(),company);await page.getByRole('cell',{name:title,exact:true}).waitFor();
 mode='empty';await page.route(pattern,route);await page.reload();await page.getByRole('heading',{name:'Henüz evrak yok',exact:true}).waitFor();await page.getByRole('button',{name:'İlk evrakı yükle',exact:true}).click();await page.getByRole('dialog',{name:'Evrak Yukle',exact:true}).waitFor();await page.keyboard.press('Escape');await page.unroute(pattern,route);
 await page.setViewportSize({width:1280,height:900});sql(`DELETE FROM documents WHERE id IN ('${ids[0]}','${ids[1]}') AND created_by='${user}'`);
 console.log('PASS document list reload/back preferences, Turkish search, company UUID filter, role-isolated preferences, empty vs filtered vs error, missing saved choice, debounce-safe clear/focus, mobile and empty upload entry');
}
