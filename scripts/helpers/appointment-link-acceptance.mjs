import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function checkAppointmentLink({page,sql,user,tenant,first,prefix,origin,output}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');
 const contract=randomUUID(),target=randomUUID(),other=randomUUID(),unrelated=randomUUID();
 const attendee=prefix+'-'+('UzunKatılımcıAdı'.repeat(6)),otherAttendee=prefix+'-other-appointment',unrelatedAttendee=prefix+'-unrelated-appointment',query=prefix+'-no-match';
 sql(`INSERT INTO contracts(id,tenant_id,company_id,name,created_by) VALUES('${contract}','${tenant}','${company}','${prefix}-appointment-contract','${user}');
 INSERT INTO appointments(id,tenant_id,company_id,contract_id,meeting_date,meeting_type,status,attendee,result,next_action,created_by) VALUES
 ('${target}','${tenant}','${company}','${contract}','2026-10-01','ziyaret','planlandi','${attendee}',NULL,NULL,'${user}'),
 ('${other}','${tenant}','${company}','${contract}','2026-10-02','ziyaret','tamamlandi','${otherAttendee}','Sentetik sonuç','Sentetik takip','${user}'),
 ('${unrelated}','${tenant}','${company}',NULL,'2026-10-03','ziyaret','planlandi','${unrelatedAttendee}',NULL,NULL,'${user}')`);
 const before=sql(`SELECT json_agg(a ORDER BY id) FROM appointments a WHERE id IN ('${target}','${other}','${unrelated}')`);
 const search=page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true}),panel=page.getByRole('dialog',{name:'Randevu Detay',exact:true});
 await page.goto(origin+'/randevular');await search.fill(query);await page.getByRole('combobox',{name:'Durum',exact:true}).selectOption('iptal');await page.getByRole('heading',{name:'Bu filtrelerle eşleşen randevu yok',exact:true}).waitFor();
 await page.waitForFunction(query=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]==='randevular'&&JSON.parse(sessionStorage.getItem(k)).search===query),query);
 const path=origin+'/sozlesmeler/'+contract;await page.goto(path);
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'Bağlı Randevular',exact:true})}),link=section.locator(`a[href="/randevular?randevu=${target}"]`);
 await link.waitFor();assert.equal(await section.getByRole('link').count(),2);assert.equal(await section.getByText(unrelatedAttendee,{exact:true}).count(),0);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await link.scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}));}
 await page.setViewportSize({width:390,height:844});await link.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/contract-appointment-cards-390.png'});
 let writes=0;const watch=r=>{if(['PATCH','DELETE'].includes(r.method()))writes++;};page.on('request',watch);
 await link.focus();await page.keyboard.press('Enter');await panel.getByText(attendee,{exact:true}).waitFor();await page.waitForURL(origin+'/randevular');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await panel.getByText(attendee,{exact:true}).evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:output+'/linked-appointment-open-390.png'});
 await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await search.inputValue(),query);await page.setViewportSize({width:1280,height:900});assert.equal(await page.getByRole('combobox',{name:'Durum',exact:true}).inputValue(),'iptal');
 await page.goBack();await page.waitForURL(path);await section.locator(`a[href="/randevular?randevu=${other}"]`).click();await panel.getByText(otherAttendee,{exact:true}).waitFor();await page.waitForURL(origin+'/randevular');await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
 for(const value of ['bad',target+'&randevu='+target,randomUUID()]){
  await page.goto(origin+'/randevular?koru=1&randevu='+value);
  await page.getByText(value==='bad'||value.includes('&')?'Randevu bağlantısı geçersiz.':'Randevu bulunamadı veya bu randevu için erişiminiz yok.',{exact:true}).waitFor();assert.equal(await panel.count(),0);
  await page.getByRole('button',{name:'Bağlantıyı kapat',exact:true}).click();await page.waitForURL(origin+'/randevular?koru=1');
 }
 // Never diagnose a read failure as a missing appointment; retry consumes only the link parameter.
 const pattern='**/rest/v1/appointments?*';const fail=async route=>route.request().method()==='GET'?route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic appointment list unavailable"}'}):route.fallback();
 await page.route(pattern,fail);await page.goto(origin+'/randevular?koru=1&randevu='+target);await page.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await page.getByText('Randevu bulunamadı veya bu randevu için erişiminiz yok.',{exact:true}).count(),0);assert.equal(await panel.count(),0);
 await page.unroute(pattern,fail);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await panel.getByText(attendee,{exact:true}).waitFor();await page.waitForURL(origin+'/randevular?koru=1');await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
 // A stale source link must not select a different appointment after deletion.
 await page.goto(path);await link.waitFor();assert.equal(sql(`SELECT json_agg(a ORDER BY id) FROM appointments a WHERE id IN ('${target}','${other}','${unrelated}')`),before);
 sql(`DELETE FROM appointments WHERE id='${target}' AND created_by='${user}'`);await link.click();await page.getByText('Randevu bulunamadı veya bu randevu için erişiminiz yok.',{exact:true}).waitFor();assert.equal(await panel.count(),0);page.off('request',watch);assert.equal(writes,0);
 console.log('PASS contract-to-appointment exact targets, saved filters, Enter/back/no reopen, mobile long cards, invalid/duplicate/missing/stale target, preserved query and read failure/retry without writes');
}
