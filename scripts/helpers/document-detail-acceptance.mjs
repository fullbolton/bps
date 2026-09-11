import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkDocumentDetail({page,sql,user,tenant,first,prefix,origin,output}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),id=randomUUID(),title=prefix+'-'+('UzunEvrakAdı'.repeat(10));
 sql(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,created_by) VALUES('${id}','${company}','${tenant}','${title}','diger','eksik','${user}')`);
 const path=origin+'/qa-document-scope',search=page.getByRole('textbox',{name:'Evrak, firma ara...',exact:true}),trigger=page.getByRole('button',{name:title,exact:true}),panel=page.getByRole('dialog',{name:'Evrak detayı',exact:true}),selected=panel.getByRole('region',{name:'Seçili evrak',exact:true});
 await page.goto(path);await search.fill(prefix);await trigger.waitFor();await page.waitForTimeout(350);
 for(const width of [320,390,1280]) {
  await page.setViewportSize({width,height:844});await trigger.scrollIntoViewIfNeeded();assert.ok(await trigger.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}));
  assert.equal(await page.getByRole('region',{name:'Kayıt tablosu, yatay kaydırılabilir',exact:true}).evaluate(e=>e.scrollLeft),0);
  await trigger.focus();await page.keyboard.press('Enter');await panel.waitFor();await selected.getByRole('heading',{name:title,exact:true}).waitFor();await selected.getByText('Henüz dosya yüklenmemiş',{exact:true}).waitFor();await selected.getByText('Belirtilmemiş',{exact:true}).waitFor();
  assert.ok(await panel.evaluate(e=>e.contains(document.activeElement)));for(let i=0;i<5;i++){await page.keyboard.press('Tab');assert.ok(await panel.evaluate(e=>e.contains(document.activeElement)));}
  assert.ok(await panel.evaluate(e=>e.scrollWidth<=innerWidth&&[...e.querySelectorAll('h3,dd,p,a')].every(x=>{const r=x.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
  if(width===390)await page.screenshot({path:output+'/document-detail-390.png'});
  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.ok(await trigger.evaluate(e=>e===document.activeElement));assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 }
 await trigger.click();const link=selected.getByRole('link',{name:first,exact:true});assert.equal(await link.getAttribute('href'),'/firmalar/'+company);assert.ok(await link.evaluate(e=>e.getBoundingClientRect().height>=44));await link.focus();await page.keyboard.press('Enter');await page.waitForURL(origin+'/firmalar/'+company);await page.getByRole('heading',{name:first,exact:true}).waitFor();await page.goBack();await search.waitFor();assert.equal(await search.inputValue(),prefix);await trigger.waitFor();assert.equal(await panel.count(),0);
 await trigger.click();sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:'operasyon'}).waitFor();await panel.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:'yonetici'}).waitFor();await search.waitFor();assert.equal(await search.inputValue(),prefix);assert.equal(await panel.count(),0);
 sql(`DELETE FROM documents WHERE id='${id}' AND created_by='${user}'`);
 console.log('PASS document name keyboard/mobile entry at 320/390/1280 without horizontal scroll, selected record details, long-name wrap, focus containment/Escape return, UUID company navigation/back preferences and role-change dismissal');
}
