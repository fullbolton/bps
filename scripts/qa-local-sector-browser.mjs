/** Browser acceptance using only the parent pilot's temporary local account. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

export async function acceptSectorBrowser({origin,jar,bank,hotel,day,requestId,output,pass,writeFixture}){
 assert.equal(origin,'http://127.0.0.1:3010','Browser pilot requires the isolated web server');
 const require=createRequire(import.meta.url);
 const {chromium}=require(process.env.BPS_PLAYWRIGHT_MODULE??'playwright');
 const browser=await chromium.launch({headless:true,...(process.env.BPS_CHROME_EXECUTABLE?{executablePath:process.env.BPS_CHROME_EXECUTABLE}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  await context.addCookies([...jar].map(([name,value])=>({name,value,url:origin,httpOnly:false,sameSite:'Lax'})));
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const daily=company=>`${origin}/talepler/gunluk?firma=${company}&gun=${day}`;
  const checkContext=async(company,label)=>{
   await page.waitForFunction(id=>[...document.querySelectorAll('select')].some(select=>select.value===id),company);
   assert.equal(await page.getByRole('combobox',{name:/^Firma/}).first().inputValue(),company,label);
   const url=new URL(page.url());assert.equal(url.searchParams.get('firma'),company);assert.equal(url.searchParams.get('gun'),day);
  };
  for(const [name,company,total] of [['bank',bank,[9,9,3,6]],['hotel',hotel,[2,5,4,1]]]){
   await page.goto(daily(company));
   await page.locator('article[id^="talep-"]').first().waitFor();await checkContext(company,name);
   assert.equal(await page.getByLabel('İş günü',{exact:true}).inputValue(),day);
   await page.getByRole('link',{name:'Haftalık plan ve çıktı',exact:true}).click();
   const plan=page.getByRole('region',{name:'Haftalık plan',exact:true});await plan.waitFor();await checkContext(company,name);
   for(const [i,label] of ['Aktif talep','İhtiyaç (kişi-gün)','Atanan (kişi-gün)','Açık (kişi-gün)'].entries()){
    assert.equal(await plan.getByText(label,{exact:true}).locator('..').locator('p').last().innerText(),String(total[i]));
   }
   const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Müşteri listesi indir (CSV)',exact:true}).click()]);
   assert.equal(await download.failure(),null);const file=`${output}/${name}-browser.csv`;await download.saveAs(file);
   execFileSync('python3',['-c',`import csv,sys,datetime
def load(path):
 rows=list(csv.DictReader(open(path,encoding='utf-8-sig',newline=''),delimiter=';'))
 assert rows
 for row in rows:
  datetime.datetime.fromisoformat(row.pop('Veri alınma zamanı'))
 return rows
assert load(sys.argv[1])==load(sys.argv[2]), 'Browser CSV business rows differ from HTTP export'
`,file,`${output}/${name}.csv`],{stdio:['ignore','pipe','pipe'],timeout:10000});
   if(name==='hotel'){
    const attendance=page.getByRole('region',{name:'Haftalık gerçekleşme',exact:true});
    await attendance.getByRole('button',{name:'Gerçekleşmeyi getir',exact:true}).click();
    await attendance.getByRole('button',{name:'Gerçekleşmeyi yenile',exact:true}).waitFor();
    for(const [label,value] of [['Geldi (kişi-gün)',1],['Gelmedi bildirimi',1],['Bildirilmemiş aktif atama',3]]){
     assert.equal(await attendance.getByText(label,{exact:true}).locator('..').locator('strong').innerText(),String(value));
    }
    await page.screenshot({path:output+'/hotel-weekly.png',fullPage:true});
   }
   await page.getByRole('link',{name:'Günlük plana dön',exact:true}).click();
   await page.locator('article[id^="talep-"]').first().waitFor();await checkContext(company,name);
   pass(name+': browser daily/weekly context, totals and real CSV button download');
  }
  await page.reload();
  const request=page.locator(`#talep-${requestId}`);await request.waitFor();
  const attendance=request.getByRole('region',{name:'Gerçekleşme bildirimleri'});
  assert.match(await attendance.innerText(),/Sentetik gelmeyen personel · atama kaldırıldı · Gelmedi/);
  assert.match(await attendance.innerText(),/Sentetik yedek personel · Geldi/);
  await page.setViewportSize({width:390,height:844});await request.scrollIntoViewIfNeeded();
  await page.screenshot({path:output+'/hotel-daily-mobile.png',fullPage:true});
  assert.ok(await request.getByText('Sentetik yedek personel',{exact:true}).first().isVisible());
  assert.deepEqual(errors,[],'No browser runtime errors');
  pass('hotel: browser reload preserves absent history and confirmed replacement; mobile rendering',{browserWrites:false});
  if(writeFixture){
   await page.setViewportSize({width:1440,height:1000});
   const f=writeFixture;
   for(const [company,location,name,oldWorker,replacement] of [
    [bank,f.bankLocation,'Sentetik gelmeyen personel',f.first,f.bankReplacement],
    [hotel,f.hotelLocation,'Sentetik ikinci personel',f.secondWorker,f.hotelReplacement],
   ]){
    await page.goto(daily(company));await checkContext(company,company);
    const form=page.locator('form').filter({has:page.getByRole('button',{name:'Talebi kaydet',exact:true})});
    await form.locator('select[name="locationId"]').selectOption(location);
    await form.getByLabel('Pozisyon',{exact:true}).fill('Tarayıcı kabul görevi');
    await form.getByRole('button',{name:'Talebi kaydet',exact:true}).click();
    const created=page.locator('article').filter({has:page.getByRole('heading',{name:/Tarayıcı kabul görevi$/})});
    await created.waitFor();
    let target;
    if(company===bank){
     const assign=created.locator('form').filter({has:page.getByRole('button',{name:'Ata',exact:true})});
     await assign.locator('select').selectOption(oldWorker);
     await assign.getByRole('button',{name:'Ata',exact:true}).click();
     target=created;
    }else target=page.locator(`#talep-${requestId}`);
    const group=target.getByRole('group',{name:name+' gerçekleşme',exact:true});
    await group.getByRole('button',{name:'Gelmedi',exact:true}).click();
    await page.waitForFunction(({id,name})=>{
     const root=id?document.getElementById('talep-'+id):[...document.querySelectorAll('article')].find(a=>a.querySelector('h3')?.textContent?.endsWith('Tarayıcı kabul görevi'));
     return [...(root?.querySelectorAll('[role="group"]')??[])].find(g=>g.getAttribute('aria-label')===name+' gerçekleşme')?.querySelectorAll('[aria-pressed="true"]')[0]?.textContent==='Gelmedi';
    },{id:company===hotel?requestId:null,name});
    const active=target.locator('li').filter({has:page.getByText(name,{exact:true})}).filter({has:page.getByRole('button',{name:'Atamayı kaldır',exact:true})});
    await active.locator('summary').click();
    await active.locator('select[name="workerId"]').selectOption(replacement);
    await active.getByRole('button',{name:'Değişimi kaydet',exact:true}).click();
    const replacementName=company===bank?'Sentetik tarayıcı banka yedeği':'Sentetik tarayıcı otel yedeği';
    await target.getByText(replacementName,{exact:true}).waitFor();
    await page.reload();
    await target.getByText(replacementName,{exact:true}).waitFor();
    assert.equal(await created.count(),1);
    assert.match(await target.getByRole('region',{name:'Gerçekleşme bildirimleri'}).innerText(),new RegExp(name+' · atama kaldırıldı · Gelmedi'));
    await page.screenshot({path:output+(company===bank?'/bank-browser-write.png':'/hotel-browser-write.png'),fullPage:true});
    pass((company===bank?'bank':'hotel')+': browser creates request, records absence, replaces worker and reloads',{browserWrites:true});
   }
   assert.deepEqual(errors,[],'No runtime errors during browser writes');
  }
 }finally{await browser.close();}
}
