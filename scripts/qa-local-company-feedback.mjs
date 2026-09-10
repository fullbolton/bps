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
 }
 await page.goto(origin+'/firmalar');await page.getByRole('button',{name:'Yeni Firma',exact:true}).click();const rejected=prefix+'-denied';await nameInput().fill(rejected);
 sql(`UPDATE profiles SET role='operasyon' WHERE id='${user}'`);await create().click();await page.getByRole('alert').filter({hasText:'Yetkisiz: firma oluşturma yetkiniz yok.'}).waitFor();
 assert.equal(await nameInput().inputValue(),rejected);assert.ok(await heading().isVisible());assert.ok(await create().isEnabled());assert.equal(count(rejected),'0');
 await page.screenshot({path:output+'/error-preserves-form.png'});assert.deepEqual(errors,[]);console.log('PASS server denial preserves editable form and creates no row');console.log('Evidence: '+output);
}catch(e){if(page)await page.screenshot({path:output+'/failure.png'}).catch(()=>{});console.error('Company feedback acceptance failed: '+e.message+'; evidence '+output);process.exitCode=1;}
finally {
 releaseRequest?.();await browser?.close();
 if(sql&&user)try{
  sql(`BEGIN;DELETE FROM companies WHERE tenant_id='${id(1)}' AND created_by='${user}' AND name LIKE '${prefix}%';DELETE FROM tenant_memberships WHERE user_id='${user}';DELETE FROM profiles WHERE id='${user}';COMMIT;`);
  assert.ifError((await admin.auth.admin.deleteUser(user)).error);console.log('Owned synthetic companies and Auth account removed');
 }catch(e){console.error('Cleanup failed: '+e.message);process.exitCode=1;}
 release?.();
}
