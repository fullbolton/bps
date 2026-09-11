import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkPreparationDraft({page,sql,user,tenant,prefix,origin,output,setRelease}) {
 const a=randomUUID(),b=randomUUID(),code='D'+randomUUID().slice(0,12),day='2026-10-12',next='2026-10-13';
 const locationName=prefix+'-new-branch',workerName=prefix+'-new-worker';
 const selector=page.getByRole('combobox',{name:'Firma',exact:true}),date=page.getByLabel('İş günü',{exact:true});
 // Section selectors also work against the previous build for the loss reproduction.
 const location=page.locator('details').filter({has:page.locator(':scope > summary').filter({hasText:/^Lokasyon ekle$/})}).locator('form');
 const worker=page.locator('details').filter({has:page.locator(':scope > summary').filter({hasText:/^Personel ekle$/})}).locator('form');
 const request=page.getByRole('form',{name:'Günlük talep formu',exact:true});
 const field=(form,name)=>form.locator(`[name="${name}"]`);
 const dialog=page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true});
 const expand=async()=>{await page.getByText('Şube ve personel hazırlığı',{exact:true}).click();await page.getByText('Lokasyon ekle',{exact:true}).click();await page.getByText('Personel ekle',{exact:true}).click();};
 const names=async expected=>{for(const label of ['Lokasyon','Personel','Günlük talep'])assert.equal(await dialog.getByText(new RegExp(label+'(?=,| formundaki)')).count()>0,expected.includes(label),label);};
 const cancel=async()=>{await dialog.getByRole('button',{name:'Vazgeç',exact:true}).click();await dialog.waitFor({state:'hidden'});};
 let release;
 try {
  sql(`INSERT INTO companies(id,tenant_id,name,status,created_by) VALUES('${a}','${tenant}','${prefix}-prep-A','aktif','${user}'),('${b}','${tenant}','${prefix}-prep-B','aktif','${user}')`);
  await page.goto(origin+'/talepler/gunluk?firma='+a+'&gun='+day);await page.getByRole('heading',{name:'Bu gün için talep yok',exact:true}).waitFor();await expand();
  if(process.env.BPS_PREPARATION_DRAFT_REPRO==='1') {
   await field(location,'name').fill(locationName);await field(worker,'name').fill(workerName);await selector.selectOption(b);await page.waitForURL(u=>u.searchParams.get('firma')===b);await expand();assert.equal(await field(location,'name').inputValue(),'');assert.equal(await field(worker,'name').inputValue(),'');console.log('REPRO confirmed: company change silently discarded location and worker drafts');return;
  }
  // Each preparation field independently triggers the same guard; restoring its default is clean.
  for(const [form,name,value,baseline,label] of [[location,'name',locationName,'','Lokasyon'],[location,'city','İstanbul','','Lokasyon'],[worker,'name',workerName,'','Personel'],[worker,'code',code,'','Personel'],[worker,'kind','sabit','idp','Personel']]) {
   const input=field(form,name);if(name==='kind')await input.selectOption(value);else await input.fill(value);
   // Project a disabled field without changing its draft; FormData would omit it.
   if(name==='city')await input.evaluate(e=>e.disabled=true);
   await selector.selectOption(b);await dialog.waitFor();await names([label]);await cancel();assert.equal(await input.inputValue(),value);assert.equal(new URL(page.url()).searchParams.get('firma'),a);
   if(name==='city')await input.evaluate(e=>e.disabled=false);
   if(name==='kind')await input.selectOption(baseline);else await input.fill(baseline);
  }
  await field(location,'name').fill(locationName);await field(location,'city').fill('İstanbul');await field(worker,'name').fill(workerName);await field(worker,'code').fill(code);await field(worker,'kind').selectOption('sabit');await field(request,'position').fill(prefix+'-draft');
  await page.getByText('Şube ve personel hazırlığı',{exact:true}).click(); // Closed details still contain drafts.
  await date.fill(next);await dialog.waitFor();await names(['Lokasyon','Personel','Günlük talep']);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/preparation-drafts-390.png'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await date.inputValue(),day);assert.ok(await date.evaluate(e=>e===document.activeElement));await page.getByText('Şube ve personel hazırlığı',{exact:true}).click();
  assert.equal(await field(location,'city').inputValue(),'İstanbul');assert.equal(await field(worker,'kind').inputValue(),'sabit');assert.equal(await field(request,'position').inputValue(),prefix+'-draft');
  // A real location write must reset only its own form and lock the selectors while pending.
  let arrived;const incoming=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);setRelease(release);let writes=0;
  const hold=async route=>{const r=route.request();if(r.method()==='POST'&&(r.postData()??'').includes(locationName)){writes++;const response=await route.fetch();arrived();await gate;return route.fulfill({response});}await route.fallback();};
  await page.route('**/talepler/gunluk?*',hold);await location.getByRole('button',{name:'Lokasyonu kaydet',exact:true}).click();let timer;try{await Promise.race([incoming,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Location action not intercepted')),20000))]);}finally{clearTimeout(timer);}
  assert.ok(await selector.isDisabled());assert.ok(await date.isDisabled());assert.equal(sql(`SELECT count(*) FROM ops_locations WHERE company_id='${a}' AND name='${locationName}'`),'1');release();await page.getByText('İşlem kaydedildi.',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('[aria-label="Firma"]').disabled);await page.unroute('**/talepler/gunluk?*',hold);assert.equal(writes,1);assert.equal(await field(location,'name').inputValue(),'');assert.equal(await field(worker,'name').inputValue(),workerName);
  await selector.selectOption(b);await dialog.waitFor();await names(['Personel','Günlük talep']);await cancel();
  await worker.getByRole('button',{name:'Personeli kaydet',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Personel hazırlık formu"] [name="name"]').value==='');await page.waitForFunction(()=>!document.querySelector('[aria-label="Firma"]').disabled);
  assert.equal(sql(`SELECT count(*) FROM ops_workers WHERE tenant_id='${tenant}' AND code='${code}' AND name='${workerName}' AND kind='sabit'`),'1');assert.equal(await field(worker,'kind').inputValue(),'idp');assert.equal(await field(request,'position').inputValue(),prefix+'-draft');await date.fill(next);await dialog.waitFor();await names(['Günlük talep']);await cancel();
  await field(request,'position').fill('Temizlik görevlisi');await date.fill(next);await page.waitForURL(u=>u.searchParams.get('gun')===next);assert.equal(await dialog.count(),0);
  await expand();await field(location,'name').fill('Bırakılacak şube');await field(worker,'code').fill('Bırakılacak kod');await selector.selectOption(b);await dialog.waitFor();await names(['Lokasyon','Personel']);await dialog.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await page.waitForURL(u=>u.searchParams.get('firma')===b);await expand();assert.equal(await field(location,'name').inputValue(),'');assert.equal(await field(worker,'code').inputValue(),'');
  assert.equal(sql(`SELECT count(*) FROM ops_locations WHERE company_id IN ('${a}','${b}')`),'1');assert.equal(sql(`SELECT count(*) FROM ops_daily_requests WHERE company_id IN ('${a}','${b}')`),'0');console.log('PASS preparation fields individually, closed multi-form drafts, cancel/Escape/mobile/focus, real location/worker writes reset independently, pending selector lock, default restoration and explicit discard');
 } finally {
  release?.();sql(`DELETE FROM ops_events WHERE actor_id='${user}' AND (entity_id IN (SELECT id FROM ops_locations WHERE company_id IN ('${a}','${b}')) OR entity_id IN (SELECT id FROM ops_workers WHERE tenant_id='${tenant}' AND code='${code}' AND name='${workerName}'));DELETE FROM ops_commands WHERE actor_id='${user}';DELETE FROM ops_workers WHERE tenant_id='${tenant}' AND code='${code}' AND name='${workerName}';DELETE FROM ops_locations WHERE company_id IN ('${a}','${b}');DELETE FROM companies WHERE id IN ('${a}','${b}') AND created_by='${user}'`);await page.setViewportSize({width:1280,height:900});
 }
}
