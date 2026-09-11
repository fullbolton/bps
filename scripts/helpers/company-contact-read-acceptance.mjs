import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkCompanyContactRead({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),ids=Array.from({length:5},()=>randomUUID());
 const names=ids.map((_,i)=>prefix+'-contact-'+i+(i===0?'x'.repeat(100):''));
 for(let i=0;i<5;i++)sql(`INSERT INTO contacts(id,tenant_id,company_id,full_name,title,email,phone,is_primary,context_note,created_by,created_at) VALUES('${ids[i]}','${tenant}','${company}','${names[i]}','Synthetic title','contact${i}@example.test','+90 555 000 00 01',${i===0},'${'uzunnot'.repeat(25)}','${user}','2026-09-0${i+1}T09:00:00Z')`);
 const path=origin+'/qa-company-scope/'+company,pattern='**/rest/v1/contacts?*';
 const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}),tab=tabs.getByRole('button',{name:'Yetkililer',exact:true});
 const section=page.getByRole('heading',{name:'Yetkili Kişiler',exact:true}).locator('..').locator('..');
 const add=section.getByRole('button',{name:'Yetkili Ekle',exact:true});
 const matches=route=>route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('company_id')==='eq.'+company;
 const fail=route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"PRIVATE_CONTACT_DIAGNOSTIC"}'});
 const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Contact read signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 let writes=0;const watch=r=>{if(['POST','PATCH','DELETE'].includes(r.method())&&new URL(r.url()).pathname==='/rest/v1/contacts')writes++;};page.on('request',watch);
 let arrived,unlock;const arrival=new Promise(r=>arrived=r),gate=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{if(matches(route)){arrived();await gate;await fail(route);}else await route.fallback();};await page.route(pattern,held);await page.goto(path);await signal(arrival);await tab.click();
 await section.getByText('Yükleniyor…',{exact:true}).waitFor();assert.ok(await add.isDisabled());assert.equal(await section.getByText('Yetkili kişi yok',{exact:true}).count(),0);assert.equal(await section.getByText('Maksimum 5 yetkili',{exact:true}).count(),0);
 unlock();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.ok(await add.isDisabled());assert.equal(await page.getByText(/PRIVATE_CONTACT/).count(),0);assert.equal(await section.getByText('Yetkili kişi yok',{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});await section.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-contact-error-390.png'});await page.unroute(pattern,held);
 await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await section.getByText('Maksimum 5 yetkili',{exact:true}).waitFor();assert.equal(await add.count(),0);for(const name of names)await section.getByText(name,{exact:true}).waitFor();
 assert.equal(await section.getByRole('link',{name:'+90 555 000 00 01',exact:true}).first().getAttribute('href'),'tel:+905550000001');assert.equal(await section.getByRole('link',{name:'contact0@example.test',exact:true}).getAttribute('href'),'mailto:contact0@example.test');
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-contact-list-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const labels=await section.locator('div.space-y-0 > div p.font-medium').allTextContents();assert.deepEqual(labels,names);
 sql(`DELETE FROM contacts WHERE id='${ids[4]}' AND created_by='${user}'`);await page.reload();await tab.click();await section.getByText(names[0],{exact:true}).waitFor();assert.ok(await add.isEnabled());assert.equal(await section.getByText('Maksimum 5 yetkili',{exact:true}).count(),0);
 await page.setViewportSize({width:1280,height:900});
 for(const mode of ['success','error']) {
  let reached,release,done,once=false;const incoming=new Promise(r=>reached=r),blocked=new Promise(r=>release=r),finished=new Promise(r=>done=r);setRelease(release);
  const late=async route=>{if(matches(route)&&!once){once=true;const response=mode==='success'?await route.fetch():null;reached();await blocked;if(response)await route.fulfill({response});else await fail(route);done();}else await route.fallback();};await page.route(pattern,late);await page.reload();await signal(incoming);
  const next=prefix+'-current-contact-'+mode;sql(`UPDATE contacts SET full_name='${next}' WHERE id='${ids[0]}'`);await role('operasyon');await tab.click();await section.getByText(next,{exact:true}).waitFor();assert.equal(await add.count(),0);
  await role('yonetici');await tab.click();await section.getByText(next,{exact:true}).waitFor();release();await signal(finished);await page.waitForTimeout(250);await section.getByText(next,{exact:true}).waitFor();assert.equal(await section.getByText('Veri yüklenemedi',{exact:true}).count(),0);assert.ok(await add.isEnabled());await page.unroute(pattern,late);
 }
 sql(`DELETE FROM contacts WHERE company_id='${company}' AND created_by='${user}'`);await page.reload();await tab.click();await section.getByText('Yetkili kişi yok',{exact:true}).waitFor();assert.ok(await add.isEnabled());
 for(const value of ['ik','muhasebe','goruntuleyici']) {
  let reads=0;const readWatch=r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.pathname==='/rest/v1/contacts'&&u.searchParams.get('company_id')==='eq.'+company)reads++;};page.on('request',readWatch);await role(value);await page.reload();await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();assert.equal(await tab.count(),0);assert.equal(reads,0);page.off('request',readWatch);
 }
 await role('yonetici');page.off('request',watch);assert.equal(writes,0);
 // Exercise the real contact delete callback's refresh without depending on Storage.
 const deleteId=randomUUID(),deleteName=prefix+'-delete-refresh';
 sql(`INSERT INTO contacts(id,tenant_id,company_id,full_name,email,created_by) VALUES('${deleteId}','${tenant}','${company}','${deleteName}','delete@example.test','${user}')`);
 await page.goto(path);await tab.click();await section.getByRole('button',{name:deleteName+' — kalıcı olarak sil',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Yetkili kişiyi kalıcı olarak sil',exact:true});await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.getByText(deleteName+' yetkili kişilerden silindi.',{exact:true}).waitFor();await section.getByText('Yetkili kişi yok',{exact:true}).waitFor();assert.ok(await add.isEnabled());assert.equal(sql(`SELECT count(*) FROM contacts WHERE id='${deleteId}'`),'0');

 console.log('PASS contact read loading/error blocks unverified create count, retry/5 limit/4 allowance/empty, mobile long fields and links, old success/error through real role A→B→A, hidden roles no GET without UI writes, and separate actual contact deletion refresh');
}
