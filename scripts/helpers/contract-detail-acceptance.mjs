import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

/** Real local Auth + PostgREST; injected failures affect only this browser. */
export async function checkContractDetail({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 const contract=randomUUID(),title=prefix+'-detail';
 assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');
 sql(`INSERT INTO contracts(id,tenant_id,company_id,name,start_date,end_date,created_by) VALUES('${contract}','${tenant}','${company}','${title}','2026-10-01','2026-12-31','${user}')`);
 const path=origin+'/sozlesmeler/'+contract,pattern='**/rest/v1/contracts?*';
 const detailGet=route=>route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('id')==='eq.'+contract;
 const failure=route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic detail unavailable"}'});
 const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Detail signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const editor=page.getByRole('dialog',{name:'Sözleşme Düzenle',exact:true});
 const edit=page.getByRole('button',{name:'Sözleşmeyi Düzenle',exact:true});
 const status=page.getByRole('combobox',{name:'Sözleşme durumu',exact:true});
 const renewal=page.getByRole('checkbox',{name:'Yenileme görüşmesi açıldı',exact:true});
 const tasks=page.locator('section').filter({has:page.getByRole('heading',{name:'Bağlı Görevler',exact:true})});
 const appointments=page.locator('section').filter({has:page.getByRole('heading',{name:'Bağlı Randevular',exact:true})});
 const failMain=async route=>detailGet(route)?failure(route):route.fallback();
 await page.route(pattern,failMain);await page.goto(path);
 await page.getByRole('heading',{name:'Sözleşme yüklenemedi',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Sözleşme bulunamadı',exact:true}).count(),0);
 await page.unroute(pattern,failMain);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await edit.waitFor();
 assert.equal(await page.getByRole('link',{name:first+' →',exact:true}).getAttribute('href'),'/firmalar/'+company);
 // Linked sections must not present failed or pending reads as an empty result.
 for(const [table,section,empty] of [['tasks',tasks,'Bağlı görev yok'],['appointments',appointments,'Bağlı randevu yok']]){
  const linkedPattern='**/rest/v1/'+table+'?*';let reached,release;
  const incoming=new Promise(r=>reached=r),gate=new Promise(r=>release=r);setRelease(release);
  const hold=async route=>{if(new URL(route.request().url()).searchParams.get('contract_id')==='eq.'+contract){reached();await gate;await failure(route);}else await route.fallback();};
  await page.route(linkedPattern,hold);await page.reload();await signal(incoming);await edit.waitFor();
  await section.getByText('Yükleniyor…',{exact:true}).waitFor();assert.equal(await section.getByRole('heading',{name:empty,exact:true}).count(),0);
  release();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await section.getByRole('heading',{name:empty,exact:true}).count(),0);
  await page.unroute(linkedPattern,hold);await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await section.getByRole('heading',{name:empty,exact:true}).waitFor();
 }
 console.log('PASS contract detail read failure/retry, canonical company link and linked loading/error/empty separation');
 // Hold a real write: all competing controls remain disabled; repeat DOM events do not PATCH again.
 let reached,release,patches=0;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>release=r);setRelease(release);
 const held=async route=>{if(route.request().method()==='PATCH'&&new URL(route.request().url()).searchParams.get('id')==='eq.'+contract){patches++;reached();await gate;}await route.fallback();};
 await page.route(pattern,held);await status.selectOption('aktif');await signal(incoming);
 await page.getByText('Sözleşme güncelleniyor…',{exact:true}).waitFor();assert.ok(await status.isDisabled());assert.ok(await renewal.isDisabled());assert.ok(await edit.isDisabled());
 assert.ok(await page.getByRole('button',{name:'Sözleşmeyi Kalıcı Olarak Sil',exact:true}).isDisabled());
 await status.evaluate(e=>e.dispatchEvent(new Event('change',{bubbles:true})));assert.equal(patches,1);
 release();await page.getByText('Sözleşme durumu güncellendi.',{exact:true}).waitFor();await edit.waitFor();await page.unroute(pattern,held);
 assert.equal(sql(`SELECT status FROM contracts WHERE id='${contract}'`),'aktif');
 await renewal.click();await page.getByText('Yenileme görüşmesi bilgisi güncellendi.',{exact:true}).waitFor();await edit.waitFor();assert.equal(sql(`SELECT renewal_discussion_opened FROM contracts WHERE id='${contract}'`),'t');assert.ok(await renewal.isChecked());
 // Error keeps the draft; successful write + failed refresh announces each independently.
 await edit.click();await editor.getByLabel('Kapsam',{exact:true}).fill('Güncellenmiş sentetik kapsam');
 const failWrite=async route=>route.request().method()==='PATCH'?failure(route):route.fallback();await page.route(pattern,failWrite);
 await editor.getByRole('button',{name:'Güncelle',exact:true}).click();await editor.getByRole('alert').waitFor();assert.equal(await editor.getByLabel('Kapsam',{exact:true}).inputValue(),'Güncellenmiş sentetik kapsam');await page.unroute(pattern,failWrite);
 let committed=false;const failedRefresh=async route=>{if(route.request().method()==='PATCH'){const response=await route.fetch();committed=true;await route.fulfill({response});}else if(committed&&detailGet(route))await failure(route);else await route.fallback();};
 await page.route(pattern,failedRefresh);await editor.getByRole('button',{name:'Güncelle',exact:true}).click();await editor.waitFor({state:'hidden'});
 await page.getByText('Sözleşme bilgileri güncellendi.',{exact:true}).waitFor();await page.getByRole('heading',{name:'Sözleşme yüklenemedi',exact:true}).waitFor();
 assert.equal(sql(`SELECT scope FROM contracts WHERE id='${contract}'`),'Güncellenmiş sentetik kapsam');await page.unroute(pattern,failedRefresh);
 let retryWrites=0;const watch=r=>{if(r.method()==='PATCH')retryWrites++;};page.on('request',watch);
 await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await edit.waitFor();assert.equal(retryWrites,0);page.off('request',watch);
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/contract-detail-390.png'});await page.setViewportSize({width:1280,height:900});
 console.log('PASS detail single pending write, status/renewal success, edit failure retains draft, saved-vs-refresh-error notice and read-only retry, 320/390/1280');
 // Same URL, real role refresh: old read and committed-but-delayed edit cannot enter a new instance.
 await page.goto(origin+'/qa-contract-detail/'+contract);await edit.waitFor();
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 for(const mode of ['read','write']){
  let arrived,done,unlock,once=false;const arrival=new Promise(r=>arrived=r),delivered=new Promise(r=>done=r),blocked=new Promise(r=>unlock=r);setRelease(unlock);
  const late=async route=>{if(!once&&(mode==='read'?detailGet(route):route.request().method()==='PATCH')){once=true;const response=await route.fetch();arrived();await blocked;await route.fulfill({response});done();}else await route.fallback();};await page.route(pattern,late);
  if(mode==='read'){await page.getByRole('button',{name:'PDF kaydını yeniden yükle',exact:true}).click();}else{await edit.click();await editor.getByLabel('Kapsam',{exact:true}).fill('Gecikmiş kayıt');await editor.getByRole('button',{name:'Güncelle',exact:true}).click();}
  await signal(arrival);sql(`UPDATE contracts SET name='${title}-${mode}' WHERE id='${contract}'`);
  await role('operasyon');await page.getByRole('heading',{name:title+'-'+mode,exact:true}).waitFor();assert.equal(await editor.count(),0);
  await role('yonetici');await edit.click();await editor.getByLabel('Kapsam',{exact:true}).fill('Yeni oturum taslağı');
  unlock();await signal(delivered);await page.waitForTimeout(350);assert.ok(await editor.isVisible());assert.equal(await editor.getByLabel('Kapsam',{exact:true}).inputValue(),'Yeni oturum taslağı');assert.equal(await page.getByText('Sözleşme bilgileri güncellendi.',{exact:true}).count(),0);
  await page.unroute(pattern,late);await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true}).getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await editor.waitFor({state:'hidden'});
 }
 console.log('PASS detail real role A-to-B-to-A discards old read and delayed committed edit without closing/announcing in new draft');
 // Server action delete: failed transport retains confirmation; retry deletes exactly this fixture.
 const confirmation=page.getByRole('dialog',{name:'Sözleşmeyi kalıcı olarak sil',exact:true});
 await page.getByRole('button',{name:'Sözleşmeyi Kalıcı Olarak Sil',exact:true}).click();await confirmation.waitFor();
 const deletePattern='**/qa-contract-detail/'+contract;
 const failDelete=async route=>route.request().method()==='POST'?failure(route):route.fallback();
 await page.route(deletePattern,failDelete);await confirmation.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await confirmation.getByRole('alert').waitFor();
 assert.equal(sql(`SELECT count(*) FROM contracts WHERE id='${contract}'`),'1');await page.unroute(deletePattern,failDelete);
 await confirmation.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await page.getByRole('heading',{name:'Sözleşme silindi',exact:true}).waitFor();
 assert.equal(sql(`SELECT count(*) FROM contracts WHERE id='${contract}'`),'0');assert.ok(await page.getByRole('heading',{name:'Sözleşme silindi',exact:true}).evaluate(e=>e===document.activeElement));
 console.log('PASS detail delete transport error preserves confirmation/row; retry confirms deletion and focuses result');

}
