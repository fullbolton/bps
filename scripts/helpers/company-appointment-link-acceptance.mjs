import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
export async function checkCompanyAppointmentLink({page,sql,user,tenant,first,prefix,origin,output}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),another=sql(`SELECT id FROM companies WHERE id<>'${company}' AND created_by='${user}' ORDER BY id LIMIT 1`);
 const target=randomUUID(),attendee=prefix+'-'+('UzunKatılımcı'.repeat(8)),query=prefix+'-no-appointment-match';
 sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${target}','${tenant}','${company}','2026-10-01','ziyaret','planlandi','${attendee}','${user}')`);
 const before=sql(`SELECT row_to_json(a) FROM appointments a WHERE id='${target}'`),path=origin+'/firmalar/'+company;
 const sections=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}),tab=sections.getByRole('button',{name:'Randevular',exact:true}),panel=page.getByRole('dialog',{name:'Randevu Detay',exact:true});
 const selectedVisible=()=>page.waitForFunction(()=>{const nav=document.querySelector('nav[aria-label="Sayfa bölümleri"]'),button=nav?.querySelector('[aria-pressed="true"]');if(!nav||!button)return false;const n=nav.getBoundingClientRect(),b=button.getBoundingClientRect();return b.left>=n.left-1&&b.right<=n.right+1;});
 const search=page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true});
 await page.goto(origin+'/randevular');await search.fill(query);await page.getByRole('combobox',{name:'Durum',exact:true}).selectOption('iptal');await page.getByRole('heading',{name:'Bu filtrelerle eşleşen randevu yok',exact:true}).waitFor();
 await page.goto(path);await tab.click();await page.getByRole('heading',{name:'Firma Randevuları',exact:true}).waitFor();
 const link=page.locator(`a[href="/randevular?randevu=${target}"]`);await link.waitFor();
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});await link.scrollIntoViewIfNeeded();await selectedVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.ok(await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}));}
 await page.setViewportSize({width:390,height:844});await link.scrollIntoViewIfNeeded();await selectedVisible();await page.screenshot({path:output+'/company-appointment-link-390.png'});
 let writes=0;const watch=r=>{if(['PATCH','DELETE'].includes(r.method()))writes++;};page.on('request',watch);
 await link.focus();await page.keyboard.press('Enter');await panel.getByText(attendee,{exact:true}).waitFor();await page.waitForURL(origin+'/randevular');await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await search.inputValue(),query);
 await page.goBack();await page.waitForURL(path);await link.waitFor();assert.equal(await tab.getAttribute('aria-pressed'),'true');await selectedVisible();
 await page.reload();await link.waitFor();assert.equal(await tab.getAttribute('aria-pressed'),'true');await selectedVisible();
 await page.goto(origin+'/firmalar/'+another);await sections.getByRole('button',{name:'Genel Bakış',exact:true}).waitFor();assert.equal(await sections.getByRole('button',{name:'Genel Bakış',exact:true}).getAttribute('aria-pressed'),'true');
 await page.goto(path);await link.waitFor();assert.equal(await tab.getAttribute('aria-pressed'),'true');await selectedVisible();
 // Even a manually planted preference cannot reveal a tab hidden from this role.
 const viewerKey='bps:list-view:v1:'+JSON.stringify(['firma-sekme',`${company}:${user}:${tenant}:goruntuleyici`]);
 await page.evaluate(key=>sessionStorage.setItem(key,JSON.stringify({search:'',filters:{tab:'randevular'}})),viewerKey);sql(`UPDATE profiles SET role='goruntuleyici' WHERE id='${user}'`);await page.reload();
 await page.waitForFunction(()=>document.querySelector('nav[aria-label="Sayfa bölümleri"]')?.querySelectorAll('button').length===1);assert.equal(await sections.getByRole('button',{name:'Genel Bakış',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await link.count(),0);
 sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);await page.reload();await link.waitFor();assert.equal(await tab.getAttribute('aria-pressed'),'true');await selectedVisible();
 const managerKey='bps:list-view:v1:'+JSON.stringify(['firma-sekme',`${company}:${user}:${tenant}:yonetici`]);
 await page.evaluate(key=>sessionStorage.setItem(key,JSON.stringify({search:'',filters:{tab:'unknown-tab'}})),managerKey);await page.reload();await sections.getByRole('button',{name:'Genel Bakış',exact:true}).waitFor();assert.equal(await sections.getByRole('button',{name:'Genel Bakış',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.getByRole('heading',{name:'Firma Randevuları',exact:true}).count(),0);
 await tab.click();await link.waitFor();page.off('request',watch);assert.equal(writes,0);assert.equal(sql(`SELECT row_to_json(a) FROM appointments a WHERE id='${target}'`),before);await page.setViewportSize({width:1280,height:900});
 console.log('PASS company appointment link exact target/filter preservation, Enter/mobile, back/reload restores source tab, per-company preference, real viewer role rejects planted hidden tab, invalid preference fallback and no appointment writes');
}
