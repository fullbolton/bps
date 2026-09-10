import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export async function checkConversationBrowser({jars,company,request,setRecipientAllowed}){
 const {chromium}=createRequire(import.meta.url)(process.env.BPS_PLAYWRIGHT_MODULE??'playwright');
 const browser=await chromium.launch({headless:true,executablePath:process.env.BPS_CHROME_EXECUTABLE});
 const origin='http://127.0.0.1:3010',output=mkdtempSync('/private/tmp/bps-conversation-browser-');
 const pages=[],errors=[];
 try{
  for(const jar of jars){const context=await browser.newContext({viewport:{width:1280,height:900}});await context.addCookies([...jar].map(([name,value])=>({name,value,url:origin,sameSite:'Lax'})));const p=await context.newPage();p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));pages.push(p);}
  const url=`${origin}/talepler/gunluk?firma=${company}&gun=2026-09-10`;
  const [a,b]=pages;await a.goto(url);const thread=a.getByRole('region',{name:'Talep konuşması'});
  await thread.getByRole('button',{name:'Notlar ve konuşma',exact:true}).click();
  await thread.getByLabel('Notunuz').fill('Tarayıcıdan şube hazırlığı kontrolü.');
  await thread.getByLabel('Etiketlenecek kişiyi ara').fill('Synthetic communication 1');
  await thread.getByRole('checkbox',{name:'Synthetic communication 1'}).check();
  await thread.getByRole('button',{name:'Notu gönder',exact:true}).click();
  await thread.locator('li').getByText('Tarayıcıdan şube hazırlığı kontrolü.',{exact:true}).waitFor();
  await a.reload();await thread.getByRole('button',{name:'Notlar ve konuşma',exact:true}).click();await thread.locator('li').getByText('Tarayıcıdan şube hazırlığı kontrolü.',{exact:true}).waitFor();
  await b.goto(url);await b.getByRole('button',{name:/^Bildirimler/}).click();const inbox=b.getByRole('region',{name:'Bildirim kutusu'});
  const item=inbox.locator('li').filter({hasText:'Tarayıcıdan şube hazırlığı kontrolü.'});await item.waitFor();
  await item.getByRole('button',{name:'Okundu işaretle'}).click();await item.getByText('Okundu',{exact:true}).waitFor();
  await b.reload();await b.getByRole('button',{name:/^Bildirimler/}).click();await item.getByText('Okundu',{exact:true}).waitFor();
  await item.getByRole('link',{name:'Talebe git'}).click();await b.waitForURL(u=>u.searchParams.get('talep')===request);assert.equal(new URL(b.url()).searchParams.get('talep'),request);
  const replyThread=b.getByRole('region',{name:'Talep konuşması'});await replyThread.getByRole('button',{name:'Notlar ve konuşma',exact:true}).click();
  await replyThread.locator('li').filter({hasText:'Tarayıcıdan şube hazırlığı kontrolü.'}).getByRole('button',{name:'Yanıtla',exact:true}).click();
  await replyThread.getByLabel('Notunuz').fill('Tarayıcıdan hazırlık tamamlandı.');await replyThread.getByRole('button',{name:'Notu gönder',exact:true}).click();await replyThread.locator('li').getByText('Tarayıcıdan hazırlık tamamlandı.',{exact:true}).waitFor();
  await a.getByRole('button',{name:/^Bildirimler/}).click();await a.getByRole('region',{name:'Bildirim kutusu'}).getByText('Tarayıcıdan hazırlık tamamlandı.',{exact:true}).waitFor();
  await a.getByRole('button',{name:'Bildirimleri kapat'}).click();
  for(const afterCommit of [true,false]){
   const label=afterCommit?'Fault_after_commit':'Fault_before_send';
   let hit;const intercepted=new Promise(r=>hit=r);
   const handler=async route=>{
    const req=route.request();if(req.method()==='POST'&&(req.postData()??'').includes(label)){
     if(afterCommit)await route.fetch();await route.abort('failed');hit();
    }else await route.continue();
   };
   await a.route('**/talepler/gunluk**',handler);
   await thread.getByLabel('Notunuz').fill(label);await thread.getByRole('button',{name:'Notu gönder',exact:true}).click();
   let timeout;try{await Promise.race([intercepted,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Fault injection was not reached')),30000);})]);}finally{clearTimeout(timeout);}
   await thread.getByRole('alert').waitFor();await a.unroute('**/talepler/gunluk**',handler);
   await a.reload();await thread.getByRole('button',{name:'Notlar ve konuşma',exact:true}).click();
   await thread.getByRole('button',{name:'Gönderimi kontrol et',exact:true}).click();
   if(afterCommit){
    await thread.getByText('Mesaj daha önce gönderilmiş. Kaydı doğruladık.',{exact:true}).waitFor();
    assert.equal(await thread.locator('li').filter({hasText:label}).count(),1);
   }else{
    await thread.getByText('Mesaj gönderilmemiş. Eski gönderimi kapattık; metni düzenleyip gönderebilirsiniz.',{exact:true}).waitFor();
    assert.equal(await thread.locator('li').filter({hasText:label}).count(),0);
    await thread.getByLabel('Notunuz').fill('Fault_corrected');await thread.getByRole('button',{name:'Notu gönder',exact:true}).click();
    await thread.locator('li').getByText('Fault_corrected',{exact:true}).waitFor();
   }
   assert.equal(await a.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('bps:comment:')).length),0);
  }
  await thread.getByLabel('Etiketlenecek kişiyi ara').fill('Synthetic communication 1');
  await thread.getByRole('checkbox',{name:'Synthetic communication 1'}).check();
  await setRecipientAllowed(false);
  await thread.getByLabel('Notunuz').fill('Rejected_recipient');await thread.getByRole('button',{name:'Notu gönder',exact:true}).click();await thread.getByRole('alert').waitFor();
  await thread.getByRole('button',{name:'Gönderimi kontrol et',exact:true}).click();
  await thread.getByText('Mesaj gönderilmemiş. Eski gönderimi kapattık; metni düzenleyip gönderebilirsiniz.',{exact:true}).waitFor();
  await thread.getByRole('button',{name:/etiketi kaldır/}).click();
  await thread.getByLabel('Notunuz').fill('Rejected_corrected');await thread.getByRole('button',{name:'Notu gönder',exact:true}).click();
  await thread.locator('li').getByText('Rejected_corrected',{exact:true}).waitFor();await setRecipientAllowed(true);
  console.log('PASS browser rejected recipient can be resolved, removed and corrected without a duplicate');
  console.log('PASS browser dropped response after commit and blocked send before server; reload resolution clears pending safely');
  await a.screenshot({path:output+'/inbox.png',fullPage:true});await b.setViewportSize({width:390,height:844});await replyThread.scrollIntoViewIfNeeded();await b.screenshot({path:output+'/thread-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS two browser sessions: mention, reload, owned read, source navigation, reply notification');console.log('Browser evidence: '+output);
 }catch(e){for(const [i,p] of pages.entries()){await p.screenshot({path:output+'/failure-'+i+'.png',fullPage:true});writeFileSync(output+'/failure-'+i+'.txt',await p.locator('body').innerText());}console.log('Failure evidence: '+output);throw e;}finally{await browser.close();}
}
