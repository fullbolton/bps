/** Real Auth/browser acceptance against the dedicated synthetic database only. */
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {validateLocalStatus,acquireLock} from './helpers/acceptance-runner.mjs';
import {id} from './fixtures/daily-operations.mjs';
const run=(cmd,args,input)=>execFileSync(cmd,args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000});
const container='supabase_db_bps-supabase-acceptance',origin='http://127.0.0.1:3010';
const prefix=`UX-${randomUUID()}`,output=mkdtempSync('/private/tmp/bps-company-feedback-');
let release,sql,admin,user,browser,page,releaseRequest;
try {
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect',container,'supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);release=acquireLock();
 sql=q=>run('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1'"),'t');
 sql(readFileSync(new URL('./fixtures/local-company-feedback.sql',import.meta.url),'utf8'));
 admin=createClient(s.API_URL,s.SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const email=`ux-${randomUUID()}@example.test`,password=randomUUID()+'Aa1!';
 const a=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{active_tenant:id(1)}});assert.ifError(a.error);user=a.data.user.id;
 sql(`INSERT INTO profiles(id,role,display_name) VALUES('${user}','yonetici','Synthetic UX acceptance');INSERT INTO tenant_memberships(user_id,tenant_id) VALUES('${user}','${id(1)}');`);
 const jar=new Map();const client=createServerClient(s.API_URL,s.ANON_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:items=>items.forEach(({name,value})=>jar.set(name,value))}});
 assert.ifError((await client.auth.signInWithPassword({email,password})).error);
 const {chromium}=createRequire(import.meta.url)(process.env.BPS_PLAYWRIGHT_MODULE??'playwright');
 browser=await chromium.launch({headless:true,executablePath:process.env.BPS_CHROME_EXECUTABLE});
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 await context.addCookies([...jar].map(([name,value])=>({name,value,url:origin,sameSite:'Lax'})));
 page=await context.newPage();page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const nameInput=()=>page.getByLabel('Firma Adı',{exact:false});
 const create=()=>page.getByRole('button',{name:'Oluştur',exact:true});
 const heading=()=>page.getByRole('heading',{name:'Yeni Firma',exact:true});
 const count=name=>sql(`SELECT count(*) FROM companies WHERE tenant_id='${id(1)}' AND name='${name}' AND created_by='${user}'`);
 await page.goto(origin+'/firmalar');await page.getByRole('button',{name:'Yeni Firma',exact:true}).click();
 const first=prefix+'-list';await nameInput().fill(first);
 let intercepted;const reached=new Promise(r=>intercepted=r),gate=new Promise(r=>releaseRequest=r);let posts=0;
 const handler=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(first)){posts++;intercepted();await gate;}await route.continue();};
 await page.route('**/*',handler);await create().click();
 let timer;try{await Promise.race([reached,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Slow request not intercepted')),30000);})]);}finally{clearTimeout(timer);}
 await page.getByText('Firma kaydediliyor, lütfen bekleyin…',{exact:true}).waitFor();assert.ok(await nameInput().isDisabled());
 assert.ok(await page.getByRole('button',{name:'Kaydediliyor…',exact:true}).isDisabled());
 await page.keyboard.press('Escape');assert.ok(await heading().isVisible());
 releaseRequest();await page.getByText(`${first} firmalara eklendi. Durumu: aday.`,{exact:true}).waitFor();await page.unroute('**/*',handler);
 assert.equal(posts,1);assert.equal(count(first),'1');await page.screenshot({path:output+'/company-created.png'});
 console.log('PASS list success, pending status, disabled inputs/submit, Escape guard and one POST/row');
 for(const [path,title,suffix] of [['/randevular','Yeni Randevu','appointment'],['/talepler','Yeni Talep','request']]){
  await page.goto(origin+path);await page.getByRole('button',{name:title,exact:true}).click();
  const picker=page.locator('select').filter({has:page.locator('option[value="__new_company__"]')});
  await picker.selectOption('__new_company__');const name=prefix+'-'+suffix;await nameInput().fill(name);await create().click();
  await page.getByText(`${name} firmalara eklendi ve bu formda seçildi.`,{exact:true}).waitFor();assert.equal(count(name),'1');assert.equal(await picker.locator('option:checked').textContent(),name);
  await picker.selectOption('__new_company__');await nameInput().fill(name);await create().click();await page.getByRole('button',{name:'Bunu seç',exact:true}).click();
  await page.getByText(`${name} mevcut kayıtlardan seçildi.`,{exact:true}).waitFor();assert.equal(count(name),'1');assert.equal(await picker.locator('option:checked').textContent(),name);
  await page.screenshot({path:output+'/'+suffix+'.png'});console.log('PASS '+suffix+' new/existing feedback, selected company and no duplicate row');
  if(process.env.BPS_DIALOG_DESIGN_CHECK==='1'){
   const dialogTitle = suffix==='request'?'Yeni Personel Talebi':title;
   await picker.focus();await picker.selectOption('__new_company__');const child=page.getByRole('dialog',{name:'Yeni Firma',exact:true});await child.waitFor();
   for(let k=0;k<12;k++){await page.keyboard.press(k%2?'Tab':'Shift+Tab');assert.ok(await child.evaluate(d=>d.contains(document.activeElement)),'Focus escapes nested dialog');}
   await page.keyboard.press('Escape');await child.waitFor({state:'hidden'});assert.ok(await page.getByRole('dialog',{name:dialogTitle,exact:true}).isVisible());
   assert.ok(await picker.evaluate(e=>e===document.activeElement),'Return to nested company picker');assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
   await page.keyboard.press('Escape');await page.getByRole('dialog',{name:dialogTitle,exact:true}).waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.ok(await page.getByRole('button',{name:title,exact:true}).evaluate(e=>e===document.activeElement),'Return to parent trigger');
  }

 }
 if(process.env.BPS_DIALOG_DESIGN_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${randomUUID()}','${id(1)}','${company}','2026-09-10','ziyaret','planlandi','UX panel kabulü','${user}');`);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/randevular');await page.getByRole('cell',{name:first,exact:true}).click();const panel=page.getByRole('dialog',{name:'Randevu Detay',exact:true});await panel.waitFor();
   for(let k=0;k<8;k++){await page.keyboard.press('Tab');assert.ok(await panel.evaluate(d=>d.contains(document.activeElement)));}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/panel-'+width+'.png'});await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
   await page.goto(origin+'/finansal-ozet');await page.getByRole('heading',{name:'Kayıtlı maliyetler',exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/finance-'+width+'.png',fullPage:true});
   const trigger=page.getByRole('button',{name:'Gelişmiş özet',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Gelişmiş finansal özet',exact:true});await dialog.waitFor();
   await page.keyboard.press('Shift+Tab');assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)));await page.screenshot({path:output+'/finance-advanced-'+width+'.png'});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.ok(await trigger.evaluate(e=>e===document.activeElement));
  }
  await page.setViewportSize({width:1280,height:900});console.log('PASS native nested dialogs, focus containment/return, scroll lock, side panels and finance desktop/mobile');
 }
 if(process.env.BPS_TABLE_DESIGN_CHECK==='1'){
  await page.goto(origin+'/qa-ui-acceptance');const table=page.getByRole('table');await table.waitFor();
  await page.getByRole('button',{name:'Sonraki',exact:true}).click();await page.getByText('25 kayıttan 11–20 gösteriliyor',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Durum',exact:true}).selectOption('aktif');await page.getByText('2 kayıttan 1–2 gösteriliyor',{exact:true}).waitFor();assert.equal(await table.locator('tbody tr').count(),2);
  await page.getByRole('button',{name:'Temizle',exact:true}).click();await page.getByText('25 kayıttan 1–10 gösteriliyor',{exact:true}).waitFor();
  const sort=page.getByRole('button',{name:'Kişi',exact:true});await sort.focus();await page.keyboard.press('Enter');assert.equal(await table.locator('tbody tr').first().locator('td').nth(1).innerText(),'1');
  assert.equal(await page.getByRole('columnheader',{name:'Kişi',exact:true}).getAttribute('aria-sort'),'ascending');
  await page.keyboard.press('Enter');assert.equal(await table.locator('tbody tr').first().locator('td').nth(1).innerText(),'100');
  const search=page.getByRole('textbox',{name:'Firma ara',exact:true});await search.fill('bulunmayan');await page.getByRole('heading',{name:'Veri bulunamadı',exact:true}).waitFor();
  await page.getByRole('button',{name:'Aramayı temizle',exact:true}).click();await table.waitFor();assert.ok(await search.evaluate(e=>e===document.activeElement));
  await table.getByRole('button',{name:'Detay',exact:true}).first().focus();await page.keyboard.press('Enter');await page.getByRole('dialog',{name:'Sentetik kayıt',exact:true}).waitFor();await page.keyboard.press('Escape');
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});const trigger=table.getByRole('button',{name:'Satır işlemleri',exact:true}).last();await trigger.click();const popup=page.getByRole('group',{name:'Kayıt işlemleri',exact:true});await popup.waitFor();
   assert.ok(await popup.getByRole('button',{name:'Kilitli işlem',exact:true}).isDisabled());const bounds=await popup.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=900,'Popover clipped/outside viewport');const anchor=await trigger.boundingBox();assert.ok(Math.min(Math.abs(bounds.y-(anchor.y+anchor.height)),Math.abs(bounds.y+bounds.height-anchor.y))<=8,'Popover detached from row trigger');
   await page.screenshot({path:output+'/table-menu-'+width+'.png'});await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.ok(await trigger.evaluate(e=>e===document.activeElement));
   await trigger.click();await popup.getByRole('button',{name:'Kaydı incele',exact:true}).click();const detail=page.getByRole('dialog',{name:'Sentetik kayıt',exact:true});await detail.waitFor();await page.keyboard.press('Escape');await detail.waitFor({state:'hidden'});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Table page overflow');
  }
  await page.setViewportSize({width:1280,height:900});console.log('PASS table filtered pagination, numeric keyboard sort, empty/clear focus, keyboard details and unclipped action popovers');
 }
 if(process.env.BPS_DETAIL_DESIGN_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`),contract=randomUUID();
  assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');
  sql(`INSERT INTO contracts(id,tenant_id,company_id,name,status,start_date,end_date,responsible,scope,created_by) VALUES('${contract}','${id(1)}','${company}','UX uzun sözleşme adı bölge hizmetleri ve operasyon takibi','aktif','2026-09-01','2027-09-01','Sentetik ekip notu','Sentetik kapsam','${user}');`);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/firmalar/'+company);
   await page.getByRole('region',{name:'Firma özeti'}).waitFor();
   const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri'});
   await tabs.getByRole('button',{name:'Sözleşmeler',exact:true}).click();
   assert.equal(await tabs.getByRole('button',{name:'Sözleşmeler',exact:true}).getAttribute('aria-pressed'),'true');
   await page.getByText('UX uzun sözleşme adı bölge hizmetleri ve operasyon takibi',{exact:true}).first().waitFor();
   await tabs.getByRole('button',{name:'Notlar',exact:true}).click();await tabs.getByRole('button',{name:'Genel Bakış',exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Company detail overflow '+width);
   await page.screenshot({path:output+'/company-detail-'+width+'.png',fullPage:true});
   await page.goto(origin+'/sozlesmeler/'+contract);const summary=page.getByRole('region',{name:'Sözleşme özeti'});await summary.waitFor();
   await page.getByRole('button',{name:'Sözleşmeyi Düzenle',exact:true}).waitFor();
   assert.equal(await summary.getByRole('link').getAttribute('href'),'/firmalar/'+company);
   await page.getByRole('navigation',{name:'Sözleşme bölümleri'}).getByRole('link',{name:'Yenileme',exact:true}).click();await page.waitForURL(u=>u.hash==='#yenileme');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Contract detail overflow '+width);
   await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:output+'/contract-detail-'+width+'.png',fullPage:true});
   await summary.getByRole('link').click();await page.waitForURL('**/firmalar/'+company);await page.getByRole('region',{name:'Firma özeti'}).waitFor();
  }
  await page.setViewportSize({width:1280,height:900});
  console.log('PASS company/contract detail desktop/mobile, tabs, renewal anchor and UUID company return');
 }
 if(process.env.BPS_WORKSPACE_DESIGN_CHECK==='1'){
  for(const [path,title] of [['/dashboard','Genel Bakış'],['/firmalar','Firmalar'],['/gorevler','Görevler'],['/randevular','Randevular'],['/sozlesmeler','Sözleşmeler'],['/finansal-ozet','Finansal Özet']]){
   await page.goto(origin+path);await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor();
   await page.locator('aside').getByRole('link',{name:'Ayarlar',exact:true}).waitFor();
   await page.waitForFunction(()=>!document.querySelector('main')?.textContent?.includes('Yükleniyor…'));
   if(path==='/dashboard')await page.getByRole('button',{name:'Tümü',exact:true}).waitFor();
   await page.screenshot({path:output+'/desktop-'+path.slice(1)+'.png',fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desktop overflow '+path);
   await page.setViewportSize({width:390,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile overflow '+path);
   await page.screenshot({path:output+'/mobile-'+path.slice(1)+'.png',fullPage:true});
   await page.getByRole('button',{name:'Menüyü aç',exact:true}).click();await page.getByRole('dialog',{name:'Gezinme menüsü'}).waitFor();
   await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog',{name:'Gezinme menüsü'}).count(),0);
   await page.setViewportSize({width:1280,height:900});
  }
  console.log('PASS workspace desktop/mobile six routes, no page overflow, mobile dialog/Escape');
 }
 await page.goto(origin+'/firmalar');await page.getByRole('button',{name:'Yeni Firma',exact:true}).click();const rejected=prefix+'-denied';await nameInput().fill(rejected);
 sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await create().click();await page.getByRole('alert').filter({hasText:'Yetkisiz: firma oluşturma yetkiniz yok.'}).waitFor();
 assert.equal(await nameInput().inputValue(),rejected);assert.ok(await heading().isVisible());assert.ok(await create().isEnabled());assert.equal(count(rejected),'0');
 await page.screenshot({path:output+'/error-preserves-form.png'});assert.deepEqual(errors,[]);console.log('PASS server denial preserves editable form and creates no row');console.log('Evidence: '+output);
}catch(e){if(page)await page.screenshot({path:output+'/failure.png'}).catch(()=>{});console.error('Company feedback acceptance failed: '+e.message+'; evidence '+output);process.exitCode=1;}
finally {
 releaseRequest?.();await browser?.close();
 if(sql&&user)try{
  sql(`BEGIN;DELETE FROM appointments WHERE created_by='${user}' AND company_id IN (SELECT id FROM companies WHERE name LIKE '${prefix}%' AND tenant_id='${id(1)}');DELETE FROM companies WHERE tenant_id='${id(1)}' AND created_by='${user}' AND name LIKE '${prefix}%';DELETE FROM tenant_memberships WHERE user_id='${user}';DELETE FROM profiles WHERE id='${user}';COMMIT;`);
  assert.ifError((await admin.auth.admin.deleteUser(user)).error);console.log('Owned synthetic companies and Auth account removed');
 }catch(e){console.error('Cleanup failed: '+e.message);process.exitCode=1;}
 release?.();
}
