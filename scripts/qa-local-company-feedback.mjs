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
const ownedStoragePaths=[];
try {
 const s=JSON.parse(run('supabase',['status','--workdir','/private/tmp/bps-supabase-acceptance','-o','json']));
 const [db,gateway]=JSON.parse(run('docker',['inspect',container,'supabase_kong_bps-supabase-acceptance']));
 validateLocalStatus(s,readFileSync('/private/tmp/bps-supabase-acceptance/supabase/config.toml','utf8'),db,gateway);release=acquireLock();
 sql=q=>run('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],q).trim();
 assert.equal(sql("SELECT obj_description(to_regclass('public.documents'))='BPS synthetic documents fixture v1'"),'t');
 sql(readFileSync(new URL('./fixtures/local-company-feedback.sql',import.meta.url),'utf8'));
 if(process.env.BPS_RECORD_DELETE_CHECK==='1'){sql(readFileSync(new URL('./fixtures/local-contact-feedback.sql',import.meta.url),'utf8'));sql(readFileSync(new URL('./fixtures/local-document-storage.sql',import.meta.url),'utf8'));}
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
 const create=()=>page.getByRole('dialog',{name:'Yeni Firma',exact:true}).getByRole('button',{name:'Oluştur',exact:true});
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
 const checkForm=async(dialog,firstField,slug)=>{
  if(process.env.BPS_FORM_DESIGN_CHECK!=='1')return;
  assert.ok(await firstField.evaluate(e=>e===document.activeElement),'Initial field focus: '+slug);
  assert.ok(await dialog.locator('label').evaluateAll(labels=>labels.length>0&&labels.every(label=>label.control&&label.control.id===label.htmlFor)),'Every label has a control: '+slug);
  assert.ok(await dialog.getByRole('button',{name:'Oluştur',exact:true}).isDisabled(),'Missing required input: '+slug);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile form width: '+slug);
  await page.screenshot({path:output+'/form-'+slug+'-mobile.png'});await page.setViewportSize({width:1280,height:900});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});const title={task:'Yeni Görev',appointment:'Yeni Randevu',contract:'Yeni Sözleşme'}[slug];const trigger=page.getByRole('button',{name:title,exact:true});assert.ok(await trigger.evaluate(e=>e===document.activeElement),'Focus returns to form trigger');await trigger.click();await dialog.waitFor();
 };
 const submitForm=async(dialog,field,token)=>{
  if(process.env.BPS_FORM_DESIGN_CHECK!=='1'){await dialog.getByRole('button',{name:'Oluştur',exact:true}).click();return;}
  let reached,posts=0;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>releaseRequest=r);
  const handler=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(token)){posts++;reached();await gate;await route.continue();}else await route.fallback();};
  await page.route('**/*',handler);await field.press('Enter');let timer;
  try{await Promise.race([incoming,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Enter did not submit '+token)),20000);})]);}finally{clearTimeout(timer);}
  await dialog.getByRole('status').filter({hasText:'Kaydediliyor, lütfen bekleyin…'}).waitFor();
  assert.ok(await dialog.locator('input,select,textarea').evaluateAll(fields=>fields.every(f=>f.matches(':disabled'))),'Pending fields are locked');
  await page.keyboard.press('Escape');assert.ok(await dialog.isVisible());await dialog.getByRole('button',{name:/penceresini kapat$/}).click();assert.ok(await dialog.isVisible());
  await dialog.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  releaseRequest();await dialog.waitFor({state:'hidden'});await page.unroute('**/*',handler);assert.equal(posts,1,'Only one pending submit');
 };
 if(process.env.BPS_WRITE_FEEDBACK_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  await page.goto(origin+'/gorevler');await page.getByRole('button',{name:'Yeni Görev',exact:true}).click();
  const taskDialog=page.getByRole('dialog',{name:'Yeni Görev',exact:true}),taskTitle=prefix+'-task';
  await checkForm(taskDialog,taskDialog.getByLabel('Görev Başlığı',{exact:false}),'task');await taskDialog.getByLabel('Görev Başlığı',{exact:false}).fill(taskTitle);await taskDialog.locator('select').first().selectOption({label:first});
  let failedReads=0;
  const failList=async route=>{const u=new URL(route.request().url());if(route.request().method()==='GET'&&u.pathname==='/rest/v1/tasks'&&u.searchParams.get('select')==='*'){failedReads++;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Sentetik liste yenileme hatası'})});}else await route.continue();};
  await page.route('**/rest/v1/tasks?*',failList);await submitForm(taskDialog,taskDialog.getByLabel('Görev Başlığı',{exact:false}),taskTitle);
  await taskDialog.waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:taskTitle+' görevlere eklendi.'}).waitFor();
  await page.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.ok(failedReads>0);assert.equal(await page.getByRole('heading',{name:'Henüz görev yok',exact:true}).count(),0);
  assert.equal(sql(`SELECT count(*) FROM tasks WHERE company_id='${company}' AND title='${taskTitle}'`),'1');
  await page.screenshot({path:output+'/task-saved-list-error.png'});await page.unroute('**/rest/v1/tasks?*',failList);
  await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await page.getByRole('cell',{name:taskTitle,exact:true}).waitFor();await page.getByRole('status').filter({hasText:taskTitle+' görevlere eklendi.'}).waitFor();assert.equal(sql(`SELECT count(*) FROM tasks WHERE company_id='${company}' AND title='${taskTitle}'`),'1');await page.reload();await page.getByRole('cell',{name:taskTitle,exact:true}).waitFor();
  await page.getByRole('cell',{name:taskTitle,exact:true}).click();const taskPanel=page.getByRole('dialog',{name:'Görev Hızlı Güncelle',exact:true});await taskPanel.waitFor();
  await taskPanel.getByRole('button',{name:'Güncellemeyi Uygula',exact:true}).click();await taskPanel.waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:'Görev güncellendi.'}).waitFor();
  await page.getByRole('button',{name:'İşlem bildirimini kapat',exact:true}).click();assert.equal(await page.getByText('Görev güncellendi.',{exact:true}).count(),0);
  await page.goto(origin+'/randevular');await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();const appointmentDialog=page.getByRole('dialog',{name:'Yeni Randevu',exact:true});
  await checkForm(appointmentDialog,appointmentDialog.getByLabel('Randevu firması',{exact:true}),'appointment');await appointmentDialog.getByLabel('Randevu firması',{exact:true}).selectOption({label:first});await appointmentDialog.locator('input[type="date"]').fill('2026-09-10');await appointmentDialog.getByLabel('Katılımcı',{exact:true}).fill(prefix+'-attendee');
  await submitForm(appointmentDialog,appointmentDialog.getByLabel('Katılımcı',{exact:true}),prefix+'-attendee');await appointmentDialog.waitFor({state:'hidden'});
  await page.getByRole('status').filter({hasText:'Randevu oluşturuldu. Durumu: planlandı.'}).waitFor();assert.equal(sql(`SELECT count(*) FROM appointments WHERE created_by='${user}' AND company_id='${company}' AND attendee='${prefix}-attendee'`),'1');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),JSON.stringify(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&!e.closest('table')).slice(0,25).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,overflow:getComputedStyle(e).overflow,width:e.clientWidth,scroll:e.scrollWidth})),containers:[...document.querySelectorAll('table')].map(e=>({self:e.getBoundingClientRect().toJSON(),parent:e.parentElement.getBoundingClientRect().toJSON(),css:getComputedStyle(e.parentElement).overflow}))}))));await page.screenshot({path:output+'/appointment-notice-mobile.png'});await page.setViewportSize({width:1280,height:900});
  await page.goto(origin+'/sozlesmeler');await page.getByRole('button',{name:'Yeni Sözleşme',exact:true}).click();const contractDialog=page.getByRole('dialog',{name:'Yeni Sözleşme',exact:true}),contractTitle=prefix+'-contract';
  await checkForm(contractDialog,contractDialog.getByLabel('Sözleşme Adı',{exact:false}),'contract');await contractDialog.getByLabel('Sözleşme Adı',{exact:false}).fill(contractTitle);await contractDialog.getByLabel('Firma',{exact:false}).selectOption({label:first});
  if(process.env.BPS_FORM_DESIGN_CHECK==='1'){
   await contractDialog.getByLabel('Başlangıç',{exact:true}).fill('2026-10-01');await contractDialog.getByLabel('Bitiş',{exact:true}).fill('2026-09-01');await contractDialog.getByRole('alert').filter({hasText:'Bitiş tarihi başlangıç tarihinden önce olamaz.'}).waitFor();
   assert.ok(await contractDialog.getByRole('button',{name:'Oluştur',exact:true}).isDisabled());assert.equal(await contractDialog.getByLabel('Bitiş',{exact:true}).getAttribute('aria-invalid'),'true');
   assert.equal(sql(`SELECT count(*) FROM contracts WHERE company_id='${company}'`),'0');await contractDialog.getByLabel('Bitiş',{exact:true}).fill('2027-10-01');
   sql(`UPDATE companies SET status='pasif' WHERE id='${company}' AND created_by='${user}'`);await contractDialog.getByRole('button',{name:'Oluştur',exact:true}).click();await contractDialog.getByRole('alert').filter({hasText:/[Pp]asif/}).waitFor();
   assert.equal(await contractDialog.getByLabel('Sözleşme Adı',{exact:false}).inputValue(),contractTitle);assert.ok(await contractDialog.getByLabel('Sözleşme Adı',{exact:false}).isEnabled());assert.equal(sql(`SELECT count(*) FROM contracts WHERE company_id='${company}'`),'0');
   sql(`UPDATE companies SET status='aday' WHERE id='${company}' AND created_by='${user}'`);
  }
  await submitForm(contractDialog,contractDialog.getByLabel('Sözleşme Adı',{exact:false}),contractTitle);await contractDialog.waitFor({state:'hidden'});
  await page.getByRole('status').filter({hasText:contractTitle+' sözleşmelere eklendi. Durumu: taslak.'}).waitFor();assert.equal(sql(`SELECT count(*) FROM contracts WHERE created_by='${user}' AND company_id='${company}' AND name='${contractTitle}' AND status='taslak'`),'1');
  await page.screenshot({path:output+'/contract-notice.png'});
  if(process.env.BPS_FORM_DESIGN_CHECK==='1'){
   const contractId=sql(`SELECT id FROM contracts WHERE company_id='${company}' AND name='${contractTitle}'`);assert.match(contractId,/^[a-f0-9-]{36}$/);await page.goto(origin+'/sozlesmeler/'+contractId);await page.getByRole('button',{name:'Sözleşmeyi Düzenle',exact:true}).click();const edit=page.getByRole('dialog',{name:'Sözleşme Düzenle',exact:true});await edit.waitFor();
   assert.ok(await edit.getByLabel('Firma',{exact:false}).isDisabled());await edit.getByLabel('Sözleşme Adı',{exact:false}).fill(contractTitle+'-edited');await edit.getByLabel('Sözleşme Adı',{exact:false}).press('Enter');await edit.waitFor({state:'hidden'});assert.equal(sql(`SELECT name FROM contracts WHERE id='${contractId}'`),contractTitle+'-edited');console.log('PASS contract edit via Enter closes and persists while company remains locked');
  }
  if(process.env.BPS_FORM_DESIGN_CHECK==='1')console.log('PASS three accessible mobile forms, initial focus, Enter submit, pending locks/close guards, one POST, date validation and server rejection/recovery');console.log('PASS task/create/update, appointment/contract saved notices, dismiss, mobile fit and successful task write with failed list refresh');
 }
 if(process.env.BPS_DIALOG_DESIGN_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${randomUUID()}','${id(1)}','${company}','2026-09-10','ziyaret','planlandi','UX panel kabulü','${user}');`);
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});await page.goto(origin+'/randevular');await page.getByRole('cell',{name:first,exact:true}).first().click();const panel=page.getByRole('dialog',{name:'Randevu Detay',exact:true});await panel.waitFor();
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
 if(process.env.BPS_RECORD_DELETE_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  let nativeDialogs=0;page.on('dialog',async d=>{nativeDialogs++;await d.dismiss();});
  for(const kind of ['contact','document']){
   const table=kind==='contact'?'contacts':'documents',tab=kind==='contact'?'Yetkililer':'Evraklar',title=kind==='contact'?'Yetkili kişiyi kalıcı olarak sil':'Belgeyi kalıcı olarak sil';
   for(const absent of [false,true]){
    const record=randomUUID(),name=prefix+'-'+kind+(absent?'-absent':'-delete');
    let storagePath=null;
    if(kind==='contact')sql(`INSERT INTO contacts(id,tenant_id,company_id,full_name,email,created_by) VALUES('${record}','${id(1)}','${company}','${name}','synthetic@example.test','${user}')`);
    else{
     if(!absent){storagePath=company+'/'+name+'.pdf';ownedStoragePaths.push(storagePath);assert.ifError((await admin.storage.from('documents').upload(storagePath,Buffer.from('%PDF-1.4\n% synthetic deletion acceptance\n%%EOF'),{contentType:'application/pdf'})).error);}
     sql(`INSERT INTO documents(id,tenant_id,company_id,name,category,status,created_by,storage_path) VALUES('${record}','${id(1)}','${company}','${name}','diger','tam','${user}',${storagePath?"'"+storagePath+"'":'NULL'})`);
    }
    await page.goto(origin+'/firmalar/'+company);await page.getByRole('navigation',{name:'Sayfa bölümleri'}).getByRole('button',{name:tab,exact:true}).click();
    const trigger=page.getByRole('button',{name:name+' — kalıcı olarak sil',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:title,exact:true});await dialog.waitFor();await dialog.getByText(name,{exact:true}).waitFor();assert.ok(await dialog.getByRole('button',{name:'Vazgeç',exact:true}).evaluate(e=>e===document.activeElement));
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(sql(`SELECT count(*) FROM ${table} WHERE id='${record}'`),'1');assert.ok(await trigger.evaluate(e=>e===document.activeElement));await trigger.click();
    if(absent){sql(`DELETE FROM ${table} WHERE id='${record}' AND created_by='${user}'`);await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('alert').filter({hasText:kind==='contact'?'Silinen yetkili kaydı doğrulanamadı':'Silinen belge kaydı doğrulanamadı'}).waitFor();}
    else{
     sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Yetkisiz:'}).waitFor();assert.equal(sql(`SELECT count(*) FROM ${table} WHERE id='${record}'`),'1');sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);
     let reached,posts=0;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>releaseRequest=r);
     const handler=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(record)){posts++;reached();await gate;await route.continue();}else await route.fallback();};
     await page.route('**/*',handler);await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();let timer;try{await Promise.race([incoming,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Delete POST missing')),20000);})]);}finally{clearTimeout(timer);}
     await dialog.getByRole('status').waitFor();assert.ok(await dialog.getByRole('button',{name:'İşlem sürüyor…',exact:true}).isDisabled());await page.keyboard.press('Escape');await dialog.getByRole('button',{name:/penceresini kapat$/}).click();assert.ok(await dialog.isVisible());
     await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/delete-'+kind+'-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));releaseRequest();await dialog.waitFor({state:'hidden'});await page.unroute('**/*',handler);assert.equal(posts,1);
     await page.getByRole('status').filter({hasText:name+(kind==='contact'?' yetkili kişilerden silindi.':' belge kaydı silindi.')}).waitFor();assert.equal(sql(`SELECT count(*) FROM ${table} WHERE id='${record}'`),'0');
     if(storagePath)assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${storagePath}'`),'0');await page.setViewportSize({width:1280,height:900});
    }
   }
  }
  // A trigger scoped to this owned path makes the real Storage API fail after DB deletion.
  const orphanId=randomUUID(),orphanName=prefix+'-storage-failure',orphanPath=company+'/'+orphanName+'.pdf';ownedStoragePaths.push(orphanPath);
  assert.ifError((await admin.storage.from('documents').upload(orphanPath,Buffer.from('%PDF-1.4\n% synthetic storage failure\n%%EOF'),{contentType:'application/pdf'})).error);
  sql(`INSERT INTO documents(id,tenant_id,company_id,name,category,status,created_by,storage_path) VALUES('${orphanId}','${id(1)}','${company}','${orphanName}','diger','tam','${user}','${orphanPath}')`);
  const fault='ux_delete_'+randomUUID().replaceAll('-','');
  sql(`BEGIN; CREATE FUNCTION public.${fault}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN IF OLD.bucket_id='documents' AND OLD.name=TG_ARGV[0] THEN RAISE EXCEPTION 'SYNTHETIC_STORAGE_DELETE_FAILURE'; END IF; RETURN OLD; END $$; CREATE TRIGGER ${fault} BEFORE DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.${fault}('${orphanPath}'); COMMIT;`);
  try{
   await page.goto(origin+'/firmalar/'+company);await page.getByRole('navigation',{name:'Sayfa bölümleri'}).getByRole('button',{name:'Evraklar',exact:true}).click();await page.getByRole('button',{name:orphanName+' — kalıcı olarak sil',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Belgeyi kalıcı olarak sil',exact:true});await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await dialog.waitFor({state:'hidden'});
   await page.getByRole('alert').filter({hasText:'Belge kaydı silindi, dosyanın temizlenmesi tamamlanamadı.'}).waitFor();assert.equal(sql(`SELECT count(*) FROM documents WHERE id='${orphanId}'`),'0');assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${orphanPath}'`),'1');await page.screenshot({path:output+'/document-storage-warning.png'});
  }finally{sql(`BEGIN; DROP TRIGGER IF EXISTS ${fault} ON storage.objects; DROP FUNCTION IF EXISTS public.${fault}(); COMMIT;`);}
  const failedRead=async route=>{if(route.request().method()==='GET')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic read failure'})});else await route.fallback();};
  for(const [table,tab,empty] of [['contacts','Yetkililer','Yetkili kişi yok'],['documents','Evraklar','Belge yok']]){
   const route='**/rest/v1/'+table+'?*';await page.route(route,failedRead);await page.reload();await page.getByRole('navigation',{name:'Sayfa bölümleri'}).getByRole('button',{name:tab,exact:true}).click();await page.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:empty,exact:true}).count(),0);await page.unroute(route,failedRead);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await page.getByRole('heading',{name:empty,exact:true}).waitFor();
  }
  assert.equal(nativeDialogs,0);console.log('PASS contact/document named confirmations, cancel, role rejection, pending guard, actual deletion/no-op, real Storage removal/failure warning and honest contact/document read-error/retry');
 }
 if(process.env.BPS_CONFIRMATION_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  let nativeDialogs=0;page.on('dialog',async d=>{nativeDialogs++;await d.dismiss();});
  const delayedConfirm=async(dialog,label,token)=>{
   let reached,posts=0;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>releaseRequest=r);
   const handler=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(token)){posts++;reached();await gate;await route.continue();}else await route.fallback();};
   await page.route('**/*',handler);await dialog.getByRole('button',{name:label,exact:true}).click();let timer;
   try{await Promise.race([incoming,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Confirmation POST missing')),20000);})]);}finally{clearTimeout(timer);}
   await dialog.getByRole('status').filter({hasText:'İşlem sürüyor, lütfen bekleyin.'}).waitFor();assert.ok(await dialog.getByRole('button',{name:'İşlem sürüyor…',exact:true}).isDisabled());assert.ok(await dialog.getByRole('button',{name:'Vazgeç',exact:true}).isDisabled());
   await page.keyboard.press('Escape');await dialog.getByRole('button',{name:/penceresini kapat$/}).click();assert.ok(await dialog.isVisible());
   releaseRequest();await dialog.waitFor({state:'hidden'});await page.unroute('**/*',handler);assert.equal(posts,1);
  };
  await page.goto(origin+'/firmalar/'+company);const passivate=page.getByRole('button',{name:'Pasife Al',exact:true});await passivate.click();let confirmation=page.getByRole('dialog',{name:'Firmayı pasife al',exact:true});await confirmation.waitFor();
  await confirmation.getByText(first,{exact:true}).waitFor();assert.ok(await confirmation.getByRole('button',{name:'Vazgeç',exact:true}).evaluate(e=>e===document.activeElement));
  await page.keyboard.press('Escape');await confirmation.waitFor({state:'hidden'});assert.equal(sql(`SELECT status FROM companies WHERE id='${company}'`),'aday');assert.ok(await passivate.evaluate(e=>e===document.activeElement));
  await passivate.click();sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await confirmation.getByRole('button',{name:'Pasife al',exact:true}).click();await confirmation.getByRole('alert').filter({hasText:'Yetkisiz:'}).waitFor();assert.equal(sql(`SELECT status FROM companies WHERE id='${company}'`),'aday');sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);
  await confirmation.getByRole('button',{name:'Vazgeç',exact:true}).click();await passivate.click();assert.equal(await confirmation.getByRole('alert').count(),0);
  sql(`UPDATE companies SET created_by=NULL WHERE id='${company}' AND created_by='${user}'`);
  try{await confirmation.getByRole('button',{name:'Pasife al',exact:true}).click();await confirmation.getByRole('alert').filter({hasText:'Firma durumu değiştirilemedi'}).waitFor();assert.equal(sql(`SELECT status FROM companies WHERE id='${company}'`),'aday');assert.equal(await page.getByText(first+' pasife alındı.',{exact:true}).count(),0);}
  finally{sql(`UPDATE companies SET created_by='${user}' WHERE id='${company}' AND tenant_id='${id(1)}' AND name='${first}'`);}
  await confirmation.getByRole('button',{name:'Vazgeç',exact:true}).click();await passivate.click();
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/confirm-company-mobile.png'});
  await delayedConfirm(confirmation,'Pasife al',company);await page.getByRole('status').filter({hasText:first+' pasife alındı.'}).waitFor();assert.equal(sql(`SELECT status FROM companies WHERE id='${company}'`),'pasif');
  await page.getByRole('button',{name:'Aktife Al',exact:true}).click();confirmation=page.getByRole('dialog',{name:'Firmayı aktife al',exact:true});await confirmation.getByRole('button',{name:'Aktife al',exact:true}).click();await confirmation.waitFor({state:'hidden'});await page.getByRole('status').filter({hasText:first+' aktife alındı.'}).waitFor();assert.equal(sql(`SELECT status FROM companies WHERE id='${company}'`),'aktif');
  await page.setViewportSize({width:1280,height:900});assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');
  for(const absent of [false,true]){
   const contractId=randomUUID(),name=prefix+(absent?'-already-absent':'-delete');sql(`INSERT INTO contracts(id,tenant_id,company_id,name,status,created_by) VALUES('${contractId}','${id(1)}','${company}','${name}','taslak','${user}')`);
   await page.goto(origin+'/sozlesmeler/'+contractId);const trigger=page.getByRole('button',{name:'Sözleşmeyi Kalıcı Olarak Sil',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Sözleşmeyi kalıcı olarak sil',exact:true});await dialog.waitFor();await dialog.getByText(name,{exact:true}).waitFor();
   assert.ok(await dialog.getByRole('button',{name:'Vazgeç',exact:true}).evaluate(e=>e===document.activeElement));await dialog.getByRole('button',{name:'Vazgeç',exact:true}).click();assert.equal(sql(`SELECT count(*) FROM contracts WHERE id='${contractId}'`),'1');await trigger.click();
   if(absent){sql(`DELETE FROM contracts WHERE id='${contractId}' AND created_by='${user}'`);await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('heading',{name:'Silinen kayıt doğrulanamadı',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Sözleşme silindi',exact:true}).count(),0);}
   else{
    sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await dialog.getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Yetkisiz:'}).waitFor();assert.equal(sql(`SELECT count(*) FROM contracts WHERE id='${contractId}'`),'1');sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);
    await page.screenshot({path:output+'/confirm-delete-error.png'});await delayedConfirm(dialog,'Kalıcı olarak sil',contractId);await page.getByRole('heading',{name:'Sözleşme silindi',exact:true}).waitFor();assert.ok(await page.getByRole('heading',{name:'Sözleşme silindi',exact:true}).evaluate(e=>e===document.activeElement));assert.equal(sql(`SELECT count(*) FROM contracts WHERE id='${contractId}'`),'0');await page.screenshot({path:output+'/contract-deleted.png'});
   }
   await page.getByRole('button',{name:'Sözleşmelere dön',exact:true}).click();await page.waitForURL('**/sozlesmeler');
  }
  assert.equal(nativeDialogs,0);console.log('PASS named confirmations, cancel/focus/no write, server denial/retry, pending guard, company status, verified delete vs zero rows, return to list and no native confirm');
 }
 if(process.env.BPS_OPERATIONS_LIST_MEMORY_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);
  assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  const taskTitle=prefix+'-assigned',otherTitle=prefix+'-unassigned',attendee=prefix+'-meeting';
  sql(`INSERT INTO tasks(tenant_id,company_id,title,assigned_to_user_id,priority,status,created_by) VALUES
   ('${id(1)}','${company}','${taskTitle}','${user}','yuksek','acik','${user}'),
   ('${id(1)}','${company}','${otherTitle}',NULL,'normal','acik','${user}');
   INSERT INTO appointments(tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by)
   VALUES('${id(1)}','${company}','2026-09-10','ziyaret','planlandi','${attendee}','${user}');`);
  const cases=[
   {route:'gorevler',query:taskTitle,placeholder:'Görev, firma, kişi ara...',panel:'Görev Hızlı Güncelle',
    filters:[['Durum','acik'],['Atama','bana'],['Öncelik','yuksek'],['Kaynak','manuel'],['Firma',first]]},
   {route:'randevular',query:attendee,placeholder:'Firma, katilimci ara...',panel:'Randevu Detay',
    filters:[['Durum','planlandi'],['Tip','ziyaret'],['Firma',first]]},
  ];
  for(const {route,query,placeholder,panel,filters} of cases) {
   await page.goto(origin+'/'+route);
   const search=page.getByRole('textbox',{name:placeholder,exact:true});
   await search.fill(query);assert.equal(await search.getAttribute('maxlength'),'512');
   for(const [label,value] of filters)await page.getByRole('combobox',{name:label,exact:true}).selectOption(value);
   await page.waitForFunction(({route,query})=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]===route&&JSON.parse(sessionStorage.getItem(k)).search===query),{route,query});
   const assertRestored=async()=>{
    await search.waitFor();await page.waitForTimeout(400);assert.equal(await search.inputValue(),query);
    for(const [label,value] of filters)assert.equal(await page.getByRole('combobox',{name:label,exact:true}).inputValue(),value);
    await page.getByRole('cell',{name:query,exact:true}).waitFor();assert.equal(await page.getByRole('table').locator('tbody tr').count(),1);
   };
   await page.reload();await assertRestored();
   await page.getByRole('cell',{name:query,exact:true}).click();await page.getByRole('dialog',{name:panel,exact:true}).waitFor();
   await page.keyboard.press('Escape');await page.getByRole('dialog',{name:panel,exact:true}).waitFor({state:'hidden'});await assertRestored();
   await page.goto(origin+'/firmalar');await page.getByRole('heading',{name:'Firmalar',level:1,exact:true}).waitFor();await page.goBack();await assertRestored();
   await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/remembered-'+route+'-mobile.png'});await page.setViewportSize({width:1280,height:900});
   await search.fill(prefix+'-no-match');await page.getByRole('heading',{name:route==='gorevler'?'Bu filtrelerle eşleşen görev yok':'Bu filtrelerle eşleşen randevu yok',exact:true}).waitFor();
   await page.getByRole('button',{name:'Aramayı temizle',exact:true}).click();assert.ok(await search.evaluate(e=>e===document.activeElement));
   await page.getByRole('button',{name:'Temizle',exact:true}).click();await page.reload();await search.waitFor();assert.equal(await search.inputValue(),'');
   for(const [label] of filters)assert.equal(await page.getByRole('combobox',{name:label,exact:true}).inputValue(),'');
   if(route==='gorevler') {
    await search.fill(otherTitle);await page.getByRole('combobox',{name:'Atama',exact:true}).selectOption('atanmamis');await page.getByRole('cell',{name:otherTitle,exact:true}).waitFor();
    await page.waitForFunction(query=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]==='gorevler'&&JSON.parse(sessionStorage.getItem(k)).search===query),otherTitle);
    await page.reload();await search.waitFor();assert.equal(await page.getByRole('combobox',{name:'Atama',exact:true}).inputValue(),'atanmamis');await page.getByRole('cell',{name:otherTitle,exact:true}).waitFor();
    await page.getByRole('combobox',{name:'Atama',exact:true}).selectOption('bana');await page.getByRole('heading',{name:'Bu filtrelerle eşleşen görev yok',exact:true}).waitFor();
   }
  }
  console.log('PASS task/appointment all filters, assigned vs unassigned, reload, panel close, browser back, empty/clear recovery, focus and mobile fit');
 }
 if(process.env.BPS_TASK_MOBILE_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);
  assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  const query=prefix+'-compact',openTitle=query+'-open',doneTitle=query+'-done';
  sql(`INSERT INTO tasks(tenant_id,company_id,title,status,created_by) VALUES
   ('${id(1)}','${company}','${openTitle}','acik','${user}'),
   ('${id(1)}','${company}','${doneTitle}','tamamlandi','${user}');`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/gorevler');
  const search=page.getByRole('textbox',{name:'Görev, firma, kişi ara...',exact:true});await search.waitFor();
  const clear=page.getByRole('button',{name:'Temizle',exact:true});if(await clear.isVisible())await clear.click();
  await search.fill(query);
  await page.waitForFunction(query=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]==='gorevler'&&JSON.parse(sessionStorage.getItem(k)).search===query),query);
  await page.getByRole('cell',{name:openTitle,exact:true}).waitFor();await page.getByRole('cell',{name:doneTitle,exact:true}).waitFor();
  const summary=page.getByRole('group',{name:'Durum filtresi',exact:true});assert.equal(await summary.getByRole('button').count(),6);
  const total=Number(sql(`SELECT count(*) FROM tasks WHERE tenant_id='${id(1)}'`));await summary.getByRole('button',{name:'Tümü '+total,exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  const disclosure=page.getByRole('button',{name:/^Filtreler/});assert.equal(await disclosure.getAttribute('aria-expanded'),'false');
  assert.equal(await page.getByRole('combobox',{name:'Durum',exact:true}).count(),0);
  assert.ok(await page.getByRole('table').locator('tbody tr').first().evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),'First task row should fit in mobile viewport');
  await page.screenshot({path:output+'/compact-tasks-390.png'});
  const completed=summary.getByRole('button',{name:/^Tamamlandı /});await completed.focus();await page.keyboard.press('Enter');assert.equal(await completed.getAttribute('aria-pressed'),'true');
  await page.getByRole('cell',{name:doneTitle,exact:true}).waitFor();assert.equal(await page.getByRole('cell',{name:openTitle,exact:true}).count(),0);
  await disclosure.filter({hasText:'1 etkin'}).waitFor();await page.reload();await disclosure.filter({hasText:'1 etkin'}).waitFor();assert.equal(await disclosure.getAttribute('aria-expanded'),'false');await page.getByRole('cell',{name:doneTitle,exact:true}).waitFor();
  await disclosure.focus();await page.keyboard.press('Enter');assert.equal(await disclosure.getAttribute('aria-expanded'),'true');
  const status=page.getByRole('combobox',{name:'Durum',exact:true});assert.equal(await status.inputValue(),'tamamlandi');await page.keyboard.press('Tab');assert.ok(await status.evaluate(e=>e===document.activeElement));
  await page.getByRole('combobox',{name:'Atama',exact:true}).selectOption('atanmamis');await disclosure.filter({hasText:'2 etkin'}).waitFor();await page.screenshot({path:output+'/task-filters-expanded-390.png'});
  await clear.click();await disclosure.filter({hasText:'Filtreler'}).waitFor();assert.equal(await disclosure.textContent(),'Filtreler');assert.equal(await search.inputValue(),query);
  await disclosure.click();assert.equal(await disclosure.getAttribute('aria-expanded'),'false');await page.keyboard.press('Tab');assert.ok(await page.getByRole('region',{name:'Kayıt tablosu, yatay kaydırılabilir',exact:true}).evaluate(e=>e===document.activeElement));
  for(const width of [320,390,1280]) {
   await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===1280){assert.ok(await status.isVisible());assert.equal(await disclosure.count(),0);await page.screenshot({path:output+'/compact-tasks-desktop.png'});}
  }
  console.log('PASS compact task summary, global counts, keyboard status filter, persisted mobile badge, disclosure/Tab/clear, first row visible at 390 and 320/390/1280 fit');
 }
 if(process.env.BPS_FILTER_BAR_CHECK==='1') {
  await page.goto(origin+'/qa-filter-bar-acceptance');
  const company=page.getByLabel('Kabul firması',{exact:true}),date=page.getByLabel('Kabul tarihi',{exact:true}),other=page.getByLabel('Diğer durum',{exact:true});
  await company.waitFor();assert.equal(new Set(await Promise.all([company,date,other].map(field=>field.getAttribute('id')))).size,3);
  for(const label of ['Kabul firması','Kabul tarihi','Diğer durum'])assert.ok(await page.locator('label').filter({hasText:label}).isVisible());
  await company.selectOption('A');await date.fill('2026-09-10');await page.getByRole('button',{name:'Seçenekleri değiştir',exact:true}).click();
  assert.equal(await company.inputValue(),'A');assert.equal(await page.getByTestId('filter-value').textContent(),'A');assert.equal(await company.locator('option:checked').textContent(),'Kayıtlı seçim (listede yok)');
  const hint=page.getByText('Kayıtlı seçim mevcut seçeneklerde yok. Seçimi değiştirin veya filtreleri temizleyin.',{exact:true});await hint.waitFor();assert.equal(await company.getAttribute('aria-describedby'),await hint.getAttribute('id'));
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/filter-missing-'+width+'.png'});}
  await page.getByRole('button',{name:'Seçenekleri değiştir',exact:true}).click();assert.equal(await company.inputValue(),'A');assert.equal(await hint.count(),0);assert.equal(await company.locator('option:checked').textContent(),'Firma A');
  const clear=page.getByRole('button',{name:'Temizle',exact:true});assert.ok(await clear.evaluate(e=>e.getBoundingClientRect().height>=44));await clear.focus();await page.keyboard.press('Enter');
  assert.equal(await company.inputValue(),'');assert.equal(await date.inputValue(),'');assert.equal(await page.getByTestId('submit-count').textContent(),'0');assert.ok(await company.evaluate(e=>e===document.activeElement));assert.equal(await clear.count(),0);
  await company.selectOption('A');await page.getByRole('button',{name:'Seçenekleri değiştir',exact:true}).click();await hint.waitFor();await company.selectOption('');assert.equal(await hint.count(),0);assert.equal(await page.getByTestId('filter-value').textContent(),'boş');
  console.log('PASS visible filter labels/unique IDs, unavailable selection stays honest, option recovery, date/clear focus without submit and 320/390/1280 fit');
 }
 if(process.env.BPS_LIST_RECOVERY_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');
  sql(`INSERT INTO tasks(tenant_id,company_id,title,created_by) VALUES('${id(1)}','${company}','${prefix}-recovery','${user}');
   INSERT INTO appointments(tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${id(1)}','${company}','2026-09-10','ziyaret','planlandi','${prefix}-recovery','${user}');
   INSERT INTO contracts(tenant_id,company_id,name,status,created_by) VALUES('${id(1)}','${company}','${prefix}-recovery','taslak','${user}');`);
  for(const [route,placeholder,status] of [['firmalar','Firma, yetkili, sektor ara...','aday'],['sozlesmeler','Sözleşme, firma ara...','taslak'],['gorevler','Görev, firma, kişi ara...','acik'],['randevular','Firma, katilimci ara...','planlandi']]) {
   await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/'+route);
   const search=page.getByRole('textbox',{name:placeholder,exact:true}),filter=page.getByRole('combobox',{name:'Durum',exact:true}),reset=page.getByRole('button',{name:'Arama ve filtreleri temizle',exact:true});
   await search.fill(prefix+'-never-matches');await filter.selectOption(status);await reset.waitFor();
   await page.setViewportSize({width:390,height:844});assert.ok(await reset.evaluate(e=>e.getBoundingClientRect().height>=44));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/recovery-'+route+'-390.png'});
   await reset.focus();await page.keyboard.press('Enter');await page.getByRole('table').waitFor();assert.equal(await search.inputValue(),'');assert.ok(await search.evaluate(e=>e===document.activeElement));assert.equal(await reset.count(),0);
   await page.setViewportSize({width:1280,height:900});for(const select of await page.getByRole('combobox').all())assert.equal(await select.inputValue(),'');
   await page.reload();await search.waitFor();assert.equal(await search.inputValue(),'');assert.equal(await filter.inputValue(),'');await page.getByRole('table').waitFor();assert.equal(await reset.count(),0);
  }
  await page.goto(origin+'/qa-list-recovery-acceptance');const pending=page.getByRole('textbox',{name:'Bekleyen arama',exact:true});await pending.fill('Zamanlayıcıdaki eski arama');
  assert.equal(await page.getByTestId('callback-count').textContent(),'0');await page.getByRole('button',{name:'Arama ve filtreleri temizle',exact:true}).click();assert.equal(await pending.inputValue(),'');assert.ok(await pending.evaluate(e=>e===document.activeElement));
  await page.waitForTimeout(3300);assert.equal(await pending.inputValue(),'');assert.equal(await page.getByTestId('callback-count').textContent(),'1');assert.equal(await page.getByTestId('submit-count').textContent(),'0');
  console.log('PASS four list empty-result reset, mobile/keyboard/focus, persisted clearing and pending debounce cancellation without form submit');
 }
 if(process.env.BPS_ASSIGNEE_LABEL_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  const currentName=prefix+'-current-name',base=prefix+'-assignment',assigned=base+'-uuid',unassigned=base+'-none',legacy=base+'-legacy';
  sql(`UPDATE profiles SET display_name='${currentName}' WHERE id='${user}';
   INSERT INTO tasks(tenant_id,company_id,title,assigned_to_user_id,assigned_to,created_by) VALUES
   ('${id(1)}','${company}','${assigned}','${user}',NULL,'${user}'),
   ('${id(1)}','${company}','${unassigned}',NULL,NULL,'${user}'),
   ('${id(1)}','${company}','${legacy}',NULL,'Eski kişi','${user}');`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/gorevler');const search=page.getByRole('textbox',{name:'Görev, firma, kişi ara...',exact:true});await search.fill(base);
  const row=title=>page.getByRole('row').filter({has:page.getByRole('cell',{name:title,exact:true})});
  await row(assigned).getByRole('cell',{name:currentName,exact:true}).waitFor();await row(unassigned).getByRole('cell',{name:'Atanmadı',exact:true}).waitFor();await row(legacy).getByRole('cell',{name:'Eski kişi (eski kayıt)',exact:true}).waitFor();
  await search.fill(currentName);await page.waitForFunction(query=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]==='gorevler'&&JSON.parse(sessionStorage.getItem(k)).search===query),currentName);await row(assigned).waitFor();assert.equal(await page.getByRole('table').locator('tbody tr').count(),1);
  await search.fill(base);await row(legacy).waitFor();
  let directoryReached;const directoryIncoming=new Promise(resolve=>directoryReached=resolve),directoryGate=new Promise(resolve=>releaseRequest=resolve);
  const delayed=async route=>{directoryReached();await directoryGate;await route.continue();};await page.route('**/rest/v1/rpc/active_tenant_profiles',delayed);await page.reload();
  let directoryTimer;try{await Promise.race([directoryIncoming,new Promise((_,reject)=>{directoryTimer=setTimeout(()=>reject(Error('Directory request missing')),20000);})]);}finally{clearTimeout(directoryTimer);}
  await row(assigned).getByRole('cell',{name:'Atanan kişi yükleniyor…',exact:true}).waitFor();await row(assigned).getByRole('cell',{name:assigned,exact:true}).click();
  const editing=page.getByRole('dialog',{name:'Görev Hızlı Güncelle',exact:true});await editing.getByLabel('Durum',{exact:true}).selectOption('devam_ediyor');releaseRequest();
  await editing.getByLabel('Atanan Kişi',{exact:true}).locator('option:checked').filter({hasText:currentName}).waitFor({state:'attached'});assert.equal(await editing.getByLabel('Durum',{exact:true}).inputValue(),'devam_ediyor');
  await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true}).getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await page.unroute('**/rest/v1/rpc/active_tenant_profiles',delayed);assert.equal(sql(`SELECT status FROM tasks WHERE title='${assigned}' AND created_by='${user}'`),'acik');
  const failed=route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic profile directory unavailable'})});
  await page.route('**/rest/v1/rpc/active_tenant_profiles',failed);await page.reload();await row(assigned).getByRole('cell',{name:'Atanan kişi bilgisi alınamadı',exact:true}).waitFor();assert.equal(await row(assigned).getByText('Atanmadı',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Kişi listesini tekrar yükle',exact:true}).waitFor();await page.screenshot({path:output+'/assignee-directory-error.png'});await page.unroute('**/rest/v1/rpc/active_tenant_profiles',failed);
  await page.getByRole('button',{name:'Kişi listesini tekrar yükle',exact:true}).click();await row(assigned).getByRole('cell',{name:currentName,exact:true}).waitFor();
  const missing=route=>route.fulfill({status:200,contentType:'application/json',body:'[]'});await page.route('**/rest/v1/rpc/active_tenant_profiles',missing);await page.reload();await row(assigned).getByRole('cell',{name:'Atanan kullanıcı listede yok',exact:true}).waitFor();
  await row(assigned).getByRole('cell',{name:assigned,exact:true}).click();const panel=page.getByRole('dialog',{name:'Görev Hızlı Güncelle',exact:true});await panel.waitFor();const picker=panel.getByLabel('Atanan Kişi',{exact:true});assert.equal(await picker.inputValue(),user);assert.ok(await picker.isDisabled());assert.equal(await picker.locator('option:checked').textContent(),'Atanan kullanıcı listede yok');await panel.getByLabel('Durum',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/assignee-missing-panel-390.png'});await page.keyboard.press('Escape');await page.unroute('**/rest/v1/rpc/active_tenant_profiles',missing);
  assert.equal(sql(`SELECT assigned_to_user_id FROM tasks WHERE title='${assigned}' AND created_by='${user}'`),user);
  await page.reload();await row(assigned).getByRole('cell',{name:currentName,exact:true}).waitFor();await page.setViewportSize({width:1280,height:900});
  console.log('PASS UUID name without legacy text, true unassigned/legacy rows, current-name search, delayed directory preserves unsaved edit, directory failure/retry, missing user and preserved disabled picker identity without writes');
 }
 if(process.env.BPS_COMPANY_LINK_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  const taskTitle=prefix+'-company-link-task',attendee=prefix+'-company-link-meeting';
  sql(`INSERT INTO tasks(tenant_id,company_id,title,created_by) VALUES('${id(1)}','${company}','${taskTitle}','${user}');
   INSERT INTO appointments(tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${id(1)}','${company}','2026-09-10','ziyaret','planlandi','${attendee}','${user}');`);
  for(const legacy of [false,true]) {
   sql(`UPDATE companies SET legacy_mock_id=${legacy?"'legacy-"+prefix+"'":"NULL"} WHERE id='${company}' AND created_by='${user}'`);
   for(const [route,query,placeholder,status,panelName] of [
    ['gorevler',taskTitle,'Görev, firma, kişi ara...','acik','Görev Hızlı Güncelle'],
    ['randevular',attendee,'Firma, katilimci ara...','planlandi','Randevu Detay'],
   ]) {
    await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/'+route);
    const search=page.getByRole('textbox',{name:placeholder,exact:true});await search.fill(query);await page.getByRole('combobox',{name:'Durum',exact:true}).selectOption(status);
    await page.waitForFunction(({route,query})=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]===route&&JSON.parse(sessionStorage.getItem(k)).search===query),{route,query});
    await page.getByRole('cell',{name:query,exact:true}).click();const panel=page.getByRole('dialog',{name:panelName,exact:true});await panel.waitFor();const link=panel.getByRole('link',{name:first,exact:true});
    assert.equal(await link.getAttribute('href'),'/firmalar/'+company);await page.setViewportSize({width:390,height:844});assert.ok(await link.evaluate(e=>e.getBoundingClientRect().height>=44));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:output+'/company-link-'+route+'-'+(legacy?'legacy':'uuid')+'-390.png'});await link.focus();await page.keyboard.press('Enter');
    await page.waitForURL(origin+'/firmalar/'+company);await page.getByRole('heading',{name:first,exact:true}).waitFor();assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await page.goBack();await page.waitForURL(origin+'/'+route);if(await panel.isVisible())await page.keyboard.press('Escape');await search.waitFor();assert.equal(await search.inputValue(),query);
    await page.setViewportSize({width:1280,height:900});assert.equal(await page.getByRole('combobox',{name:'Durum',exact:true}).inputValue(),status);await page.getByRole('cell',{name:query,exact:true}).waitFor();
   }
  }
  console.log('PASS task/appointment company links use canonical UUID with and without legacy ID, mobile/Enter navigation, correct company, dialog cleanup and preserved back filters');
 }
 if(process.env.BPS_APPOINTMENT_TASKS_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  const ids=[randomUUID(),randomUUID(),randomUUID()],names=ids.map((_,index)=>prefix+'-linked-'+index),titles=[prefix+'-follow-up-A',prefix+'-follow-up-B'];
  for(let index=0;index<3;index++)sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${ids[index]}','${id(1)}','${company}','2026-09-10','ziyaret','planlandi','${names[index]}','${user}')`);
  for(let index=0;index<2;index++)sql(`INSERT INTO tasks(tenant_id,company_id,appointment_id,title,source_type,status,created_by) VALUES('${id(1)}','${company}','${ids[index]}','${titles[index]}','randevu','${index?'tamamlandi':'acik'}','${user}')`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/randevular');await page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true}).fill(prefix+'-linked-');
  const panel=page.getByRole('dialog',{name:'Randevu Detay',exact:true}),section=panel.getByRole('region',{name:'Bağlı görevler',exact:true});
  const open=async index=>{if(await panel.isVisible())await page.keyboard.press('Escape');await page.getByRole('cell',{name:names[index],exact:true}).click();await panel.waitFor();};
  const pattern='**/rest/v1/tasks?*';
  const failed=async route=>{const url=new URL(route.request().url());if(url.searchParams.get('appointment_id')==='eq.'+ids[0])await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic linked tasks unavailable'})});else await route.continue();};
  await page.route(pattern,failed);await open(0);await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await section.getByText('Bu randevuya bağlı görev yok.',{exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/appointment-tasks-error-390.png'});
  await page.unroute(pattern,failed);await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await section.getByText(titles[0],{exact:true}).waitFor();await section.getByText('Açık',{exact:true}).waitFor();
  await page.setViewportSize({width:1280,height:900});await page.keyboard.press('Escape');
  let reached,finished;const incoming=new Promise(resolve=>reached=resolve),gate=new Promise(resolve=>releaseRequest=resolve),completed=new Promise(resolve=>finished=resolve);
  const delayed=async route=>{const url=new URL(route.request().url());if(url.searchParams.get('appointment_id')==='eq.'+ids[1]){reached();await gate;try{await route.continue();}finally{finished();}}else await route.continue();};
  await page.route(pattern,delayed);await open(1);let timer;try{await Promise.race([incoming,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Linked task request missing')),20000);})]);}finally{clearTimeout(timer);}
  await section.getByText('Yükleniyor…',{exact:true}).waitFor();assert.equal(await section.getByText(titles[0],{exact:true}).count(),0);assert.equal(await section.getByText('Bu randevuya bağlı görev yok.',{exact:true}).count(),0);
  await open(0);await section.getByText(titles[0],{exact:true}).waitFor();releaseRequest();await completed;await page.waitForTimeout(300);assert.equal(await section.getByText(titles[1],{exact:true}).count(),0);await page.unroute(pattern,delayed);
  await open(1);await section.getByText(titles[1],{exact:true}).waitFor();await section.getByText('Tamamlandı',{exact:true}).waitFor();await page.screenshot({path:output+'/appointment-tasks-content.png'});
  await open(2);await section.getByText('Bu randevuya bağlı görev yok.',{exact:true}).waitFor();assert.equal(await section.getByRole('button',{name:'Tekrar dene',exact:true}).count(),0);await page.keyboard.press('Escape');
  console.log('PASS appointment task loading/error/retry/empty/content, task statuses, mobile fit and delayed prior appointment response isolation');
 }
 if(process.env.BPS_TASK_LINK_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
  const appointment=randomUUID(),task=randomUUID(),attendee=prefix+'-deep-link',title=prefix+'-linked-task',hiddenQuery=prefix+'-no-match';
  sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${appointment}','${id(1)}','${company}','2026-09-10','ziyaret','planlandi','${attendee}','${user}');
   INSERT INTO tasks(id,tenant_id,company_id,appointment_id,title,source_type,created_by) VALUES('${task}','${id(1)}','${company}','${appointment}','${title}','randevu','${user}')`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/gorevler');const search=page.getByRole('textbox',{name:'Görev, firma, kişi ara...',exact:true});await search.fill(hiddenQuery);await page.getByRole('combobox',{name:'Durum',exact:true}).selectOption('iptal');await page.getByRole('heading',{name:'Bu filtrelerle eşleşen görev yok',exact:true}).waitFor();
  await page.waitForFunction(query=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]==='gorevler'&&JSON.parse(sessionStorage.getItem(k)).search===query),hiddenQuery);
  await page.goto(origin+'/randevular');await page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true}).fill(attendee);await page.getByRole('cell',{name:attendee,exact:true}).click();
  const appointmentPanel=page.getByRole('dialog',{name:'Randevu Detay',exact:true});const link=appointmentPanel.getByRole('link',{name:title,exact:true});await link.waitFor();assert.equal(await link.getAttribute('href'),'/gorevler?gorev='+task);
  await page.setViewportSize({width:390,height:844});assert.ok(await link.evaluate(e=>e.getBoundingClientRect().height>=44));await link.focus();await page.keyboard.press('Enter');
  const panel=page.getByRole('dialog',{name:'Görev Hızlı Güncelle',exact:true});await panel.getByRole('heading',{name:title,exact:true}).waitFor();await page.waitForURL(origin+'/gorevler');assert.equal(await panel.getByLabel('Durum',{exact:true}).inputValue(),'acik');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/linked-task-open-390.png'});
  await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await search.inputValue(),hiddenQuery);await page.setViewportSize({width:1280,height:900});assert.equal(await page.getByRole('combobox',{name:'Durum',exact:true}).inputValue(),'iptal');
  await page.goBack();await page.waitForURL(origin+'/randevular');if(await appointmentPanel.isVisible())await page.keyboard.press('Escape');assert.equal(await page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true}).inputValue(),attendee);
  for(const [value,message] of [['bad','Görev bağlantısı geçersiz.'],[randomUUID(),'Görev bulunamadı veya bu görev için erişiminiz yok.']]) {
   await page.goto(origin+'/gorevler?koru=1&gorev='+value);await page.getByText(message,{exact:true}).waitFor();assert.equal(await panel.count(),0);await page.getByRole('button',{name:'Bağlantıyı kapat',exact:true}).click();await page.waitForURL(origin+'/gorevler?koru=1');
  }
  const pattern='**/rest/v1/tasks?*';const failed=async route=>{const u=new URL(route.request().url());if(!u.searchParams.has('appointment_id')&&u.searchParams.get('select')==='*')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic task list unavailable'})});else await route.continue();};
  await page.route(pattern,failed);await page.goto(origin+'/gorevler?gorev='+task);await page.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await page.getByText('Görev bulunamadı veya bu görev için erişiminiz yok.',{exact:true}).count(),0);assert.equal(await panel.count(),0);
  await page.unroute(pattern,failed);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await panel.getByRole('heading',{name:title,exact:true}).waitFor();await page.waitForURL(origin+'/gorevler');await page.keyboard.press('Escape');
  assert.equal(sql(`SELECT status FROM tasks WHERE id='${task}' AND created_by='${user}'`),'acik');
  console.log('PASS appointment-to-task deep link, filtered-out target, mobile/Enter, no reopen, back state, invalid/missing target, preserved query and list failure/retry without writes');
 }
 if(process.env.BPS_TASK_PICKER_RECOVERY_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  let mode='hold',profileMode='error';const gate=new Promise(r=>releaseRequest=r),companiesPattern='**/rest/v1/companies?*',profilesPattern='**/rest/v1/rpc/active_tenant_profiles';
  const companies=async route=>{const u=new URL(route.request().url());if(route.request().method()==='GET'&&!u.searchParams.has('id')&&!u.searchParams.has('legacy_mock_id')){if(mode==='hold')await gate;if(mode==='error')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic task directory unavailable"}'});if(mode==='empty')return route.fulfill({status:200,contentType:'application/json',body:'[]'});}await route.fallback();};
  const profiles=async route=>{if(profileMode==='error')await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic profile unavailable"}'});else await route.fallback();};await page.route(companiesPattern,companies);await page.route(profilesPattern,profiles);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/gorevler');await page.getByRole('button',{name:'Yeni Görev',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Yeni Görev',exact:true}),companyPicker=dialog.getByLabel('Firma',{exact:false}),assignee=dialog.getByLabel('Atanan Kişi',{exact:true}),title=prefix+'-task-directory';await dialog.getByText('Firma listesi yükleniyor…',{exact:true}).waitFor();assert.ok(await companyPicker.isDisabled());await dialog.getByLabel('Görev Başlığı',{exact:false}).fill(title);await dialog.getByLabel('Termin',{exact:true}).fill('2026-10-01');await dialog.getByLabel('Öncelik',{exact:true}).selectOption('yuksek');assert.ok(await dialog.getByRole('button',{name:'Oluştur',exact:true}).isDisabled());
  mode='error';releaseRequest();await dialog.getByText('Firma listesi yüklenemedi. Tekrar deneyin.',{exact:true}).waitFor();await dialog.getByText('Kişi listesi yüklenemedi. Tekrar deneyin.',{exact:true}).waitFor();assert.equal(await dialog.getByText('Listede firma yok.',{exact:true}).count(),0);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/task-directory-error-390.png'});
  mode='ready';await dialog.getByRole('button',{name:'Firmaları tekrar yükle',exact:true}).click();await companyPicker.locator('option').filter({hasText:first}).waitFor({state:'attached'});assert.equal(await dialog.getByLabel('Görev Başlığı',{exact:false}).inputValue(),title);assert.equal(await dialog.getByLabel('Termin',{exact:true}).inputValue(),'2026-10-01');assert.equal(await dialog.getByLabel('Öncelik',{exact:true}).inputValue(),'yuksek');await companyPicker.selectOption({label:first});assert.ok(await dialog.getByRole('button',{name:'Oluştur',exact:true}).isEnabled());
  profileMode='ready';await dialog.getByRole('button',{name:'Kişileri tekrar yükle',exact:true}).click();await assignee.locator(`option[value="${user}"]`).waitFor({state:'attached'});assert.equal(await companyPicker.inputValue(),company);assert.equal(await dialog.getByLabel('Görev Başlığı',{exact:false}).inputValue(),title);await assignee.selectOption(user);await dialog.getByRole('button',{name:'Oluştur',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText(title+' görevlere eklendi.',{exact:true}).waitFor();assert.equal(sql(`SELECT count(*) FROM tasks WHERE company_id='${company}' AND title='${title}' AND due_date='2026-10-01' AND priority='yuksek' AND assigned_to_user_id='${user}'`),'1');
  mode='empty';await page.reload();await page.getByRole('button',{name:'Yeni Görev',exact:true}).click();await dialog.getByText('Listede firma yok.',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Firmaları tekrar yükle',exact:true}).count(),0);assert.ok(await companyPicker.isEnabled());await dialog.getByLabel('Görev Başlığı',{exact:false}).fill(prefix+'-must-not-save');assert.ok(await dialog.getByRole('button',{name:'Oluştur',exact:true}).isDisabled());assert.equal(sql(`SELECT count(*) FROM tasks WHERE title='${prefix}-must-not-save'`),'0');await page.keyboard.press('Escape');await page.unroute(companiesPattern,companies);await page.unroute(profilesPattern,profiles);await page.setViewportSize({width:1280,height:900});
  console.log('PASS global task company loading/error/empty, independent company/profile retry preserves title/date/priority/selection, optional unassigned state and one correctly assigned task');
 }
 if(process.env.BPS_PICKER_RECOVERY_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  let mode='hold',profileMode='error',reached;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>releaseRequest=r),pattern='**/rest/v1/companies?*';
  const companyDirectory=async route=>{const req=route.request(),url=new URL(req.url());if(req.method()==='GET'&&!url.searchParams.has('id')&&!url.searchParams.has('legacy_mock_id')){if(mode==='hold'){reached();await gate;}if(mode==='error')return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic directory unavailable"}'});if(mode==='empty')return route.fulfill({status:200,contentType:'application/json',body:'[]'});}await route.fallback();};await page.route(pattern,companyDirectory);
  await page.goto(origin+'/randevular');await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Yeni Randevu',exact:true}),picker=dialog.getByLabel('Randevu firması',{exact:true});await dialog.getByText('Firma listesi yükleniyor…',{exact:true}).waitFor();await incoming;assert.ok(await picker.isDisabled());await dialog.getByLabel('Randevu tarihi',{exact:true}).fill('2026-09-10');await dialog.getByLabel('Katılımcı',{exact:true}).fill(prefix+'-directory-appointment');assert.ok(await dialog.getByRole('button',{name:'Oluştur',exact:true}).isDisabled());
  mode='error';releaseRequest();await dialog.getByText('Firma listesi yüklenemedi. Tekrar deneyin.',{exact:true}).waitFor();assert.equal(await dialog.getByText('Listede firma yok.',{exact:true}).count(),0);assert.ok(await picker.isDisabled());await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/appointment-picker-error-390.png'});
  mode='ready';await dialog.getByRole('button',{name:'Firmaları tekrar yükle',exact:true}).click();await picker.locator('option').filter({hasText:first}).waitFor({state:'attached'});assert.equal(await dialog.getByLabel('Randevu tarihi',{exact:true}).inputValue(),'2026-09-10');assert.equal(await dialog.getByLabel('Katılımcı',{exact:true}).inputValue(),prefix+'-directory-appointment');await picker.selectOption({label:first});await dialog.getByRole('button',{name:'Oluştur',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(sql(`SELECT count(*) FROM appointments WHERE company_id='${company}' AND attendee='${prefix}-directory-appointment' AND created_by='${user}'`),'1');
  mode='empty';await page.reload();await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();await dialog.getByText('Listede firma yok.',{exact:true}).waitFor();assert.equal(await dialog.getByRole('button',{name:'Firmaları tekrar yükle',exact:true}).count(),0);assert.ok(await picker.isEnabled());assert.ok(await dialog.getByRole('button',{name:'Oluştur',exact:true}).isDisabled());await page.keyboard.press('Escape');
  const profilesPattern='**/rest/v1/rpc/active_tenant_profiles';const profileDirectory=async route=>{if(profileMode==='error')await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic profile directory unavailable"}'});else if(profileMode==='empty')await route.fulfill({status:200,contentType:'application/json',body:'[]'});else await route.fallback();};await page.route(profilesPattern,profileDirectory);mode='error';await page.setViewportSize({width:1280,height:900});await page.reload();const search=page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true});await search.fill(prefix+'-directory-appointment');
  const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:prefix+'-directory-appointment',exact:true})});await row.getByRole('button',{name:'Satır işlemleri',exact:true}).click();await page.getByRole('button',{name:'Gorev Olustur',exact:true}).filter({visible:true}).click();const task=page.getByRole('dialog',{name:'Yeni Görev',exact:true}),taskCompany=task.getByLabel('Firma',{exact:false}),assignee=task.getByLabel('Atanan Kişi',{exact:true}),taskTitle=prefix+'-directory-task';await task.getByLabel('Görev Başlığı',{exact:false}).fill(taskTitle);await task.getByText('Firma listesi yüklenemedi. Tekrar deneyin.',{exact:true}).waitFor();await task.getByText('Kişi listesi yüklenemedi. Tekrar deneyin.',{exact:true}).waitFor();assert.ok(await taskCompany.isDisabled());assert.ok(await assignee.isDisabled());assert.equal(await taskCompany.inputValue(),company);assert.ok(await task.getByRole('button',{name:'Oluştur',exact:true}).isDisabled());
  mode='ready';await task.getByRole('button',{name:'Firmaları tekrar yükle',exact:true}).click();await taskCompany.locator('option').filter({hasText:first}).waitFor({state:'attached'});assert.equal(await task.getByLabel('Görev Başlığı',{exact:false}).inputValue(),taskTitle);assert.equal(await taskCompany.inputValue(),company);assert.ok(await task.getByRole('button',{name:'Oluştur',exact:true}).isEnabled(),'Optional assignee does not block an unassigned task');profileMode='empty';await task.getByRole('button',{name:'Kişileri tekrar yükle',exact:true}).click();await task.getByText('Atanabilecek kişi yok. Görevi atamadan oluşturabilirsiniz.',{exact:true}).waitFor();assert.equal(await task.getByRole('button',{name:'Kişileri tekrar yükle',exact:true}).count(),0);await page.keyboard.press('Escape');
  profileMode='error';await page.reload();await row.getByRole('button',{name:'Satır işlemleri',exact:true}).click();await page.getByRole('button',{name:'Gorev Olustur',exact:true}).filter({visible:true}).click();await task.getByLabel('Görev Başlığı',{exact:false}).fill(taskTitle);await task.getByText('Kişi listesi yüklenemedi. Tekrar deneyin.',{exact:true}).waitFor();profileMode='ready';await task.getByRole('button',{name:'Kişileri tekrar yükle',exact:true}).click();await assignee.locator(`option[value="${user}"]`).waitFor({state:'attached'});assert.equal(await task.getByLabel('Görev Başlığı',{exact:false}).inputValue(),taskTitle);await assignee.selectOption(user);await task.getByRole('button',{name:'Oluştur',exact:true}).click();await task.waitFor({state:'hidden'});assert.equal(sql(`SELECT count(*) FROM tasks WHERE company_id='${company}' AND title='${taskTitle}' AND assigned_to_user_id='${user}'`),'1');await page.unroute(pattern,companyDirectory);await page.unroute(profilesPattern,profileDirectory);
  console.log('PASS company directory pending/error/empty distinctions, disabled invalid writes, appointment draft survives retry, task default company/title preserved, independent profile retry/empty/unassigned choice, one appointment and one correctly assigned task');
 }
 if(process.env.BPS_APPOINTMENT_REFRESH_CHECK==='1') {
  const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Refresh acceptance signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.appointments'::regclass)"),'BPS synthetic appointments fixture v1');
  const appointment=randomUUID(),query=prefix+'-race-',old=query+'old';
  sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${appointment}','${id(1)}','${company}','2026-09-10','telefon','planlandi','${old}','${user}')`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/randevular');const search=page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true}),refresh=page.getByRole('button',{name:'Listeyi yenile',exact:true});await search.fill(query);await page.getByRole('cell',{name:old,exact:true}).waitFor();
  for(const mode of ['success','error']){
   let reached,finished,held=false;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>releaseRequest=r),done=new Promise(r=>finished=r);const pattern='**/rest/v1/appointments?*';
   const delayed=async route=>{if(route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('select')==='*'&&!held){held=true;const response=mode==='success'?await route.fetch():null;reached();await gate;if(response)await route.fulfill({response});else await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic stale error"}'});finished();}else await route.fallback();};
   await page.route(pattern,delayed);await refresh.click();await signal(incoming);await page.getByRole('status').filter({hasText:'Randevular yükleniyor…'}).waitFor();assert.ok(await refresh.isDisabled());assert.equal(await page.getByRole('cell',{name:old,exact:true}).count(),0);
   await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Yeni Randevu',exact:true}),attendee=query+mode;await dialog.getByLabel('Randevu firması',{exact:true}).selectOption({label:first});await dialog.locator('input[type="date"]').fill('2026-09-10');await dialog.getByLabel('Katılımcı',{exact:true}).fill(attendee);await dialog.getByRole('button',{name:'Oluştur',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('cell',{name:attendee,exact:true}).waitFor();
   releaseRequest();await signal(done);await page.waitForTimeout(350);await page.getByRole('cell',{name:attendee,exact:true}).waitFor();assert.equal(await page.getByText('Veri yüklenemedi',{exact:true}).count(),0);assert.ok(await refresh.isEnabled());assert.equal(await search.inputValue(),query);await page.unroute(pattern,delayed);
  }
  const companiesPattern='**/rest/v1/companies?*';let reached,finished;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>releaseRequest=r),done=new Promise(r=>finished=r);
  const delayNames=async route=>{if(route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('id')?.startsWith('in.')){const response=await route.fetch();reached();await gate;await route.fulfill({response});finished();}else await route.fallback();};await page.route(companiesPattern,delayNames);await refresh.click();await signal(incoming);await page.getByRole('status').filter({hasText:'Randevular yükleniyor…'}).waitFor();assert.equal(await page.getByRole('table').count(),0);releaseRequest();await signal(done);await page.getByRole('cell',{name:old,exact:true}).waitFor();await page.unroute(companiesPattern,delayNames);
  const failNames=async route=>{if(new URL(route.request().url()).searchParams.get('id')?.startsWith('in.'))await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic display error"}'});else await route.fallback();};await page.route(companiesPattern,failNames);await refresh.click();await page.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Henüz randevu yok',exact:true}).count(),0);await page.unroute(companiesPattern,failNames);await page.getByRole('button',{name:'Tekrar dene',exact:true}).click();await page.getByRole('cell',{name:old,exact:true}).waitFor();assert.equal(await search.inputValue(),query);
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Refresh row width '+width);}await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/appointment-refresh-390.png'});
  // This route only exists in the disposable snapshot; refresh the real AuthProvider in place.
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/qa-appointment-scope');await page.getByTestId('acceptance-role').filter({hasText:'yonetici'}).waitFor();await search.fill(query);await page.getByRole('cell',{name:old,exact:true}).waitFor();
  let authReached,authFinished,authHeld=false;const authIncoming=new Promise(r=>authReached=r),authGate=new Promise(r=>releaseRequest=r),authDone=new Promise(r=>authFinished=r);const appointmentsPattern='**/rest/v1/appointments?*';
  const oldRead=async route=>{if(!authHeld){authHeld=true;const response=await route.fetch();authReached();await authGate;await route.fulfill({response});authFinished();}else await route.fallback();};await page.route(appointmentsPattern,oldRead);await refresh.click();await signal(authIncoming);
  await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();await page.getByRole('dialog',{name:'Yeni Randevu',exact:true}).waitFor();sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}';UPDATE appointments SET attendee='${query}current' WHERE id='${appointment}' AND created_by='${user}'`);
  await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:'operasyon'}).waitFor();await page.getByRole('dialog',{name:'Yeni Randevu',exact:true}).waitFor({state:'hidden'});await page.getByRole('cell',{name:query+'current',exact:true}).waitFor();releaseRequest();await signal(authDone);await page.waitForTimeout(350);assert.equal(await page.getByRole('cell',{name:old,exact:true}).count(),0);await page.getByRole('cell',{name:query+'current',exact:true}).waitFor();await page.unroute(appointmentsPattern,oldRead);
  sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:'yonetici'}).waitFor();
  const late=query+'late-create',newDialog=page.getByRole('dialog',{name:'Yeni Randevu',exact:true});await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();await newDialog.getByLabel('Randevu firması',{exact:true}).selectOption({label:first});await newDialog.locator('input[type="date"]').fill('2026-09-10');await newDialog.getByLabel('Katılımcı',{exact:true}).fill(late);
  let saved,delivered;const savedSignal=new Promise(r=>saved=r),saveGate=new Promise(r=>releaseRequest=r),deliveredSignal=new Promise(r=>delivered=r);
  const lateSave=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(late)){const response=await route.fetch();saved();await saveGate;await route.fulfill({response});delivered();}else await route.fallback();};await page.route('**/*',lateSave);await newDialog.getByRole('button',{name:'Oluştur',exact:true}).click();await signal(savedSignal);assert.equal(sql(`SELECT count(*) FROM appointments WHERE created_by='${user}' AND attendee='${late}'`),'1');
  sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:'operasyon'}).waitFor();await newDialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();await newDialog.getByLabel('Katılımcı',{exact:true}).fill('Ara kapsam taslağı');sql(`UPDATE profiles SET role='yonetici' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:'yonetici'}).waitFor();await newDialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Yeni Randevu',exact:true}).click();await newDialog.getByLabel('Katılımcı',{exact:true}).fill('Yeni kapsam taslağı');releaseRequest();await signal(deliveredSignal);await page.waitForTimeout(350);assert.ok(await newDialog.isVisible());assert.equal(await newDialog.getByLabel('Katılımcı',{exact:true}).inputValue(),'Yeni kapsam taslağı');assert.equal(await page.getByText('Randevu oluşturuldu. Durumu: planlandı.',{exact:true}).count(),0);await page.unroute('**/*',lateSave);
  await page.keyboard.press('Escape');await newDialog.waitFor({state:'hidden'});
  console.log('PASS manual refresh loading, stale success/error cannot erase newer create, rows wait for company names, display failure/retry with filters intact, 320/390/1280 fit, real Auth role change closes form/refetches and rejects prior response; late saved response after A-to-B-to-A leaves the new form and draft intact');
 }
 if(process.env.BPS_APPOINTMENT_RESULT_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.appointments'::regclass)"),'BPS synthetic appointments fixture v1');
  const appointment=randomUUID(),attendee=prefix+'-result';
  sql(`INSERT INTO appointments(id,tenant_id,company_id,meeting_date,meeting_type,status,attendee,created_by) VALUES('${appointment}','${id(1)}','${company}','2026-09-10','telefon','planlandi','${attendee}','${user}')`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/randevular');await page.getByRole('textbox',{name:'Firma, katilimci ara...',exact:true}).fill(attendee);
  const dialog=page.getByRole('dialog',{name:'Randevuyu Tamamla',exact:true}),confirm=page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true});
  const result=dialog.getByLabel('Görüşme sonucu',{exact:true}),next=dialog.getByLabel('Sonraki aksiyon',{exact:true}),save=dialog.getByRole('button',{name:'Kaydet',exact:true});
  const open=async()=>{await page.getByRole('row').filter({has:page.getByRole('cell',{name:attendee,exact:true})}).getByRole('button',{name:'Satır işlemleri',exact:true}).click();await page.getByRole('button',{name:'Tamamla',exact:true}).filter({visible:true}).click();await dialog.waitFor();};
  await open();assert.ok(await result.evaluate(e=>e===document.activeElement));assert.ok(await save.isDisabled());assert.ok(await dialog.locator('label').evaluateAll(labels=>labels.every(l=>l.control&&l.htmlFor===l.control.id)));
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await confirm.count(),0);
  await open();await result.fill('Görüşme notu');await result.press('Enter');assert.equal(await result.inputValue(),'Görüşme notu\n');assert.ok(await save.isDisabled());
  await page.keyboard.press('Escape');await confirm.waitFor();assert.ok(await confirm.getByRole('button',{name:'Vazgeç',exact:true}).evaluate(e=>e===document.activeElement));await confirm.getByRole('button',{name:'Vazgeç',exact:true}).click();assert.ok((await result.inputValue()).startsWith('Görüşme notu'));
  await dialog.getByRole('button',{name:'Randevuyu Tamamla penceresini kapat',exact:true}).click();await confirm.waitFor();await page.keyboard.press('Escape');await confirm.waitFor({state:'hidden'});assert.ok(await dialog.isVisible());
  await dialog.click({position:{x:4,y:4}});await confirm.waitFor();await confirm.getByRole('button',{name:'Vazgeç',exact:true}).click();await dialog.getByRole('button',{name:'İptal',exact:true}).click();await confirm.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(sql(`SELECT status FROM appointments WHERE id='${appointment}'`),'planlandi');
  await open();assert.equal(await result.inputValue(),'');assert.equal(await next.inputValue(),'');await result.fill('   ');await next.fill('   ');assert.ok(await save.isDisabled());
  await result.fill('Karar alındı');await next.fill(prefix+'-follow-up');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/appointment-result-390.png'});
  const pattern='**/*',matches=req=>req.method()==='POST'&&(req.postData()??'').includes(appointment);let rejected=0;
  const fail=async route=>{if(matches(route.request())){rejected++;await route.fulfill({status:503,contentType:'text/plain',body:'Synthetic unavailable'});}else await route.fallback();};await page.route(pattern,fail);await save.click();await dialog.getByRole('alert').waitFor();assert.equal(rejected,1);assert.equal(await result.inputValue(),'Karar alındı');assert.equal(await next.inputValue(),prefix+'-follow-up');assert.ok(await result.isEnabled());assert.equal(sql(`SELECT status FROM appointments WHERE id='${appointment}'`),'planlandi');assert.equal(sql(`SELECT count(*) FROM tasks WHERE appointment_id='${appointment}'`),'0');await page.unroute(pattern,fail);
  let reached,posts=0;const incoming=new Promise(resolve=>reached=resolve),gate=new Promise(resolve=>releaseRequest=resolve);
  const delayed=async route=>{if(matches(route.request())){posts++;reached();await gate;}await route.fallback();};await page.route(pattern,delayed);await dialog.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});let timer;try{await Promise.race([incoming,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Completion POST missing')),20000);})]);}finally{clearTimeout(timer);}
  await dialog.getByRole('status').filter({hasText:'Randevu kaydediliyor, lütfen bekleyin.'}).waitFor();assert.ok(await result.isDisabled());assert.ok(await next.isDisabled());assert.ok(await dialog.getByRole('button',{name:'Randevuyu Tamamla penceresini kapat',exact:true}).isDisabled());await page.keyboard.press('Escape');await dialog.click({position:{x:4,y:4}});assert.ok(await dialog.isVisible());assert.equal(await confirm.count(),0);
  releaseRequest();await dialog.waitFor({state:'hidden'});await page.unroute(pattern,delayed);assert.equal(posts,1);await page.getByRole('status').filter({hasText:'Randevu tamamlandı ve takip görevi oluşturuldu.'}).waitFor();assert.equal(sql(`SELECT status||'|'||result||'|'||next_action FROM appointments WHERE id='${appointment}'`),'tamamlandi|Karar alındı|'+prefix+'-follow-up');assert.equal(sql(`SELECT count(*) FROM tasks WHERE appointment_id='${appointment}'`),'1');
  await page.setViewportSize({width:1280,height:900});
  console.log('PASS appointment result focus/labels, textarea newline, required/whitespace, all close guards, discard without write, clean reopen, mobile, failed POST preserves text, pending lock, one completion and follow-up task, success notice');
 }
 if(process.env.BPS_TASK_PANEL_GUARD_CHECK==='1') {
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');const task=randomUUID(),title=prefix+'-panel-guard';
  sql(`INSERT INTO tasks(id,tenant_id,company_id,title,created_by) VALUES('${task}','${id(1)}','${company}','${title}','${user}')`);
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/gorevler');await page.getByRole('textbox',{name:'Görev, firma, kişi ara...',exact:true}).fill(title);
  const panel=page.getByRole('dialog',{name:'Görev Hızlı Güncelle',exact:true}),confirm=page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true});const status=panel.getByLabel('Durum',{exact:true});
  const open=async()=>{await page.getByRole('cell',{name:title,exact:true}).click();await panel.waitFor();};
  await open();await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await confirm.count(),0);
  await open();await status.selectOption('devam_ediyor');await page.keyboard.press('Escape');await confirm.waitFor();assert.ok(await confirm.getByRole('button',{name:'Vazgeç',exact:true}).evaluate(e=>e===document.activeElement));
  await confirm.getByRole('button',{name:'Vazgeç',exact:true}).click();assert.equal(await status.inputValue(),'devam_ediyor');await page.keyboard.press('Escape');await confirm.waitFor();await page.keyboard.press('Escape');await confirm.waitFor({state:'hidden'});assert.ok(await panel.isVisible());
  await panel.getByRole('button',{name:'Görev Hızlı Güncelle panelini kapat',exact:true}).click();await confirm.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await panel.waitFor({state:'hidden'});assert.equal(sql(`SELECT status FROM tasks WHERE id='${task}'`),'acik');
  await open();await status.selectOption('devam_ediyor');await panel.click({position:{x:5,y:100}});await confirm.waitFor();await confirm.getByRole('button',{name:'Vazgeç',exact:true}).click();
  await panel.getByRole('link',{name:first,exact:true}).click();await confirm.waitFor();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/task-discard-confirm-390.png'});await confirm.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await page.waitForURL(origin+'/firmalar/'+company);assert.equal(sql(`SELECT status FROM tasks WHERE id='${task}'`),'acik');
  await page.setViewportSize({width:1280,height:900});await page.goto(origin+'/gorevler?gorev='+task);await panel.waitFor();await page.waitForURL(origin+'/gorevler');await status.selectOption('devam_ediyor');
  const pattern='**/rest/v1/tasks?*';let reached,patches=0;const incoming=new Promise(resolve=>reached=resolve),gate=new Promise(resolve=>releaseRequest=resolve);
  const delayed=async route=>{if(route.request().method()==='PATCH'&&new URL(route.request().url()).searchParams.get('id')==='eq.'+task){patches++;reached();await gate;}await route.continue();};await page.route(pattern,delayed);
  await panel.getByRole('button',{name:'Güncellemeyi Uygula',exact:true}).evaluate(button=>{button.click();button.click();});let timer;try{await Promise.race([incoming,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Task PATCH missing')),20000);})]);}finally{clearTimeout(timer);}
  await panel.getByText('Görev kaydediliyor, lütfen bekleyin.',{exact:true}).waitFor();assert.ok(await status.isDisabled());assert.ok(await panel.getByLabel('Atanan Kişi',{exact:true}).isDisabled());assert.ok(await panel.getByRole('button',{name:'Görev Hızlı Güncelle panelini kapat',exact:true}).isDisabled());
  await page.keyboard.press('Escape');await panel.click({position:{x:5,y:100}});await panel.getByRole('link',{name:first,exact:true}).evaluate(link=>link.click());assert.ok(await panel.isVisible());assert.equal(await confirm.count(),0);assert.equal(page.url(),origin+'/gorevler');
  releaseRequest();await panel.waitFor({state:'hidden'});await page.unroute(pattern,delayed);assert.equal(patches,1);assert.equal(sql(`SELECT status FROM tasks WHERE id='${task}'`),'devam_ediyor');
  await page.goto(origin+'/gorevler?gorev='+task);await panel.waitFor();await status.selectOption('tamamlandi');const failed=async route=>{if(route.request().method()==='PATCH')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic update failure'})});else await route.continue();};await page.route(pattern,failed);await panel.getByRole('button',{name:'Güncellemeyi Uygula',exact:true}).click();await panel.getByRole('alert').waitFor();assert.equal(await status.inputValue(),'tamamlandi');assert.ok(await status.isEnabled());assert.equal(sql(`SELECT status FROM tasks WHERE id='${task}'`),'devam_ediyor');await page.unroute(pattern,failed);
  await panel.getByRole('button',{name:'Güncellemeyi Uygula',exact:true}).click();await panel.waitFor({state:'hidden'});assert.equal(sql(`SELECT status FROM tasks WHERE id='${task}'`),'tamamlandi');
  console.log('PASS task clean/dirty Escape, close/backdrop/link discard, cancel preserves edits, nested focus, pending fields/close/navigation lock, one PATCH and error retry');
 }
 if(process.env.BPS_LIST_MEMORY_CHECK==='1'){
  const company=sql(`SELECT id FROM companies WHERE tenant_id='${id(1)}' AND name='${first}' AND created_by='${user}'`),contract=randomUUID(),contractName=prefix+'-memory';assert.match(company,/^[a-f0-9-]{36}$/);
  assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');sql(`INSERT INTO contracts(id,tenant_id,company_id,name,status,created_by) VALUES('${contract}','${id(1)}','${company}','${contractName}','taslak','${user}')`);
  for(const [route,query,status,back] of [['firmalar',first,'aday','Firmalar'],['sozlesmeler',contractName,'taslak','Sözleşmeler']]){
   await page.goto(origin+'/'+route);const search=page.getByRole('textbox',{name:route==='firmalar'?'Firma, yetkili, sektor ara...':'Sözleşme, firma ara...',exact:true}),filter=page.getByRole('combobox',{name:'Durum',exact:true});
   await search.fill(query);await filter.selectOption(status);await page.getByRole('cell',{name:query,exact:true}).waitFor();
   await page.waitForFunction(({route,query})=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]===route&&JSON.parse(sessionStorage.getItem(k)).search===query),{route,query});
   await page.reload();await search.waitFor();await page.waitForTimeout(500);assert.equal(await search.inputValue(),query);assert.equal(await filter.inputValue(),status);assert.equal(await page.getByRole('table').locator('tbody tr').count(),1);
   await page.getByRole('cell',{name:query,exact:true}).click();await page.getByRole('button',{name:back,exact:true}).click();await search.waitFor();await page.waitForTimeout(500);assert.equal(await search.inputValue(),query);assert.equal(await filter.inputValue(),status);await page.getByRole('cell',{name:query,exact:true}).waitFor();
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/remembered-'+route+'-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:900});
   await page.getByRole('button',{name:'Aramayı temizle',exact:true}).click();await page.getByRole('button',{name:'Temizle',exact:true}).click();await page.reload();await search.waitFor();assert.equal(await search.inputValue(),'');assert.equal(await filter.inputValue(),'');
   await page.evaluate(route=>{const key=Object.keys(sessionStorage).find(k=>k.startsWith('bps:list-view:v1:')&&JSON.parse(k.slice('bps:list-view:v1:'.length))[0]===route);if(!key)throw Error('Missing preference key');sessionStorage.setItem(key,'{broken');},route);await page.reload();await search.waitFor();assert.equal(await search.inputValue(),'');assert.equal(await filter.inputValue(),'');
  }
  await page.goto(origin+'/qa-list-view-acceptance');const field=page.getByRole('textbox',{name:'Kabul araması',exact:true}),committed=page.getByTestId('committed-search');await field.fill('Birinci arama');await committed.filter({hasText:'Birinci arama'}).waitFor();await page.getByRole('combobox',{name:'Kabul durumu'}).selectOption('aktif');
  await page.getByRole('button',{name:'İkinci kapsam',exact:true}).click();await field.waitFor();assert.equal(await field.inputValue(),'');assert.equal(await page.getByRole('combobox',{name:'Kabul durumu'}).inputValue(),'');
  await field.fill('İkinci arama');await committed.filter({hasText:'İkinci arama'}).waitFor();await page.getByRole('button',{name:'Birinci kapsam',exact:true}).click();await field.waitFor();assert.equal(await field.inputValue(),'Birinci arama');assert.equal(await page.getByRole('combobox',{name:'Kabul durumu'}).inputValue(),'aktif');
  await field.fill('Bekleyen eski arama');await page.getByRole('button',{name:'İkinci kapsam',exact:true}).click();await field.waitFor();await page.waitForTimeout(500);assert.equal(await field.inputValue(),'İkinci arama');assert.equal(await committed.textContent(),'İkinci arama');
  await field.fill('Eski değer');await page.getByRole('button',{name:'Dışarıdan değiştir',exact:true}).click();await page.waitForTimeout(500);assert.equal(await field.inputValue(),'Dışarıdan');assert.equal(await committed.textContent(),'Dışarıdan');
  await page.addInitScript(()=>Object.defineProperty(window,'sessionStorage',{value:{getItem(){throw Error('Storage blocked');},setItem(){throw Error('Storage blocked');}}}));await page.reload();await field.fill('Bellekte çalışıyor');await committed.filter({hasText:'Bellekte çalışıyor'}).waitFor();await page.reload();await field.waitFor();assert.equal(await field.inputValue(),'');
  console.log('PASS company/contract list-detail-return, reload/clear/corrupt recovery, mobile fit, scope isolation, stale debounce cancellation and blocked-storage fallback');
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
  if(ownedStoragePaths.length)assert.ifError((await admin.storage.from('documents').remove(ownedStoragePaths)).error);
  sql(`BEGIN;DELETE FROM tasks WHERE company_id IN (SELECT id FROM companies WHERE name LIKE '${prefix}%' AND tenant_id='${id(1)}' AND created_by='${user}');DELETE FROM appointments WHERE created_by='${user}' AND company_id IN (SELECT id FROM companies WHERE name LIKE '${prefix}%' AND tenant_id='${id(1)}');DELETE FROM companies WHERE tenant_id='${id(1)}' AND created_by='${user}' AND name LIKE '${prefix}%';DELETE FROM tenant_memberships WHERE user_id='${user}';DELETE FROM profiles WHERE id='${user}';COMMIT;`);
  assert.ifError((await admin.auth.admin.deleteUser(user)).error);console.log('Owned synthetic companies and Auth account removed');
 }catch(e){console.error('Cleanup failed: '+e.message);process.exitCode=1;}
 release?.();
}
