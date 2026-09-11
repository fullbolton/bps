import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function checkCompanyDownload({page,sql,user,tenant,first,prefix,origin,output,admin,ownedStoragePaths,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),ids=Array.from({length:4},()=>randomUUID()),names=['a','b','pathless','missing'].map(x=>prefix+'-company-download-'+x),paths=[company+'/'+prefix+'-a.pdf',company+'/'+prefix+'-b.pdf',null,company+'/'+prefix+'-absent.pdf'];
 for(let i=0;i<2;i++){ownedStoragePaths.push(paths[i]);assert.ifError((await admin.storage.from('documents').upload(paths[i],Buffer.from('%PDF-1.4\n% Synthetic company download\n%%EOF\n'),{contentType:'application/pdf'})).error);}
 for(let i=0;i<4;i++)sql(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,storage_path,created_by) VALUES('${ids[i]}','${company}','${tenant}','${names[i]}','diger','${i===2?'eksik':'tam'}',${paths[i]?"'"+paths[i]+"'":'NULL'},'${user}')`);
 await page.clock.install();const path=origin+'/qa-company-scope/'+company,pattern='**/qa-company-scope/*';
 const panel=page.getByRole('region',{name:'Evrak indirme',exact:true}),tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}),tab=tabs.getByRole('button',{name:'Evraklar',exact:true});
 const action=i=>page.getByRole('row').filter({has:page.getByText(names[i],{exact:true})}).getByRole('button',{name:'İndir',exact:true});
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();await tab.click();await action(0).waitFor();};
 const matches=(r,i)=>r.method()==='POST'&&(r.postData()??'').includes(ids[i]);
 const signal=async p=>{let t;try{await Promise.race([p,new Promise((_,r)=>t=setTimeout(()=>r(Error('Company download signal timeout')),20000))]);}finally{clearTimeout(t);}};
 let popups=0,requests=0;const popupWatch=()=>popups++,watch=r=>{if(ids.some((_,i)=>matches(r,i)))requests++;};page.on('popup',popupWatch);page.on('request',watch);
 try{
  await page.goto(path);await tab.click();assert.ok(await action(2).isDisabled());
  let release,arrived;const gate=new Promise(r=>release=r),arrival=new Promise(r=>arrived=r);setRelease(release);
  const transport=async r=>{if(matches(r.request(),0)){arrived();await gate;return r.fulfill({status:503,contentType:'text/plain',body:'Synthetic transport internals'});}await r.fallback();};await page.route(pattern,transport);await action(0).click();await signal(arrival);await panel.getByText('Dosya bağlantısı hazırlanıyor…',{exact:true}).waitFor();assert.ok(await action(0).isDisabled());assert.ok(await action(1).isDisabled());assert.equal(requests,1);release();await panel.getByText('Dosya bağlantısı hazırlanamadı. Tekrar deneyin.',{exact:true}).waitFor();assert.equal(popups,0);await page.unroute(pattern,transport);
  await panel.getByRole('button',{name:'Bağlantıyı yeniden hazırla',exact:true}).click();const link=panel.getByRole('link',{name:'Dosyayı aç',exact:true});await link.waitFor();assert.equal(requests,2);assert.equal(popups,0);
  const response=page.context().waitForEvent('response',r=>new URL(r.url()).pathname.endsWith('/documents/'+paths[0]));const opened=page.waitForEvent('popup');await link.click();const popup=await opened;assert.equal((await response).status(),200);await popup.close();assert.equal(popups,1);
  await page.clock.fastForward(56000);await panel.getByText('Bağlantının süresi doldu. Yeniden hazırlayın.',{exact:true}).waitFor();assert.equal(await panel.getByRole('link').count(),0);
  await action(3).click();await panel.getByText('İndirme bağlantısı oluşturulamadı. Tekrar deneyin.',{exact:true}).waitFor();assert.equal(await panel.getByText('Object not found',{exact:false}).count(),0);
  // New action may queue behind the old server action. Release old response while B is visibly pending, then hold B itself.
  for(const transition of ['role-success','role-error','tab','dismiss']){
   await panel.getByRole('button',{name:'Kapat',exact:true}).click();const releases=[],arrivals=[],finishes=[],incoming=[],finished=[];
   for(let i=0;i<2;i++){incoming[i]=new Promise(r=>arrivals[i]=r);finished[i]=new Promise(r=>finishes[i]=r);}
   setRelease(()=>releases.forEach(r=>r?.()));
   const held=async r=>{const i=[0,1].find(i=>matches(r.request(),i));if(i===undefined)return r.fallback();const response=transition==='role-error'&&i===0?null:await r.fetch();const gate=new Promise(resolve=>releases[i]=resolve);arrivals[i]();await gate;await r.fulfill(response?{response}:{status:503,contentType:'text/plain',body:'Late synthetic error'});finishes[i]();};
   await page.route(pattern,held);await action(0).click();await signal(incoming[0]);
   if(transition.startsWith('role')){await role('operasyon');await role('yonetici');}
   else if(transition==='tab'){await tabs.getByRole('button',{name:'Genel Bakış',exact:true}).click();await tab.click();}
   else await panel.getByRole('button',{name:'Kapat',exact:true}).click();
   await action(1).click();await panel.getByText(names[1],{exact:true}).waitFor();releases[0]();await signal(finished[0]);await signal(incoming[1]);await panel.getByText('Dosya bağlantısı hazırlanıyor…',{exact:true}).waitFor();assert.ok(await action(0).isDisabled());assert.equal(await panel.getByRole('link').count(),0);releases[1]();await signal(finished[1]);await link.waitFor();await panel.getByText(names[1],{exact:true}).waitFor();assert.equal(popups,1);await page.unroute(pattern,held);
  }
  for(const value of ['operasyon','ik']){await role(value);await action(1).click();await link.waitFor();}
  await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-download-ready-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.clock.fastForward(56000);await panel.getByText('Bağlantının süresi doldu. Yeniden hazırlayın.',{exact:true}).waitFor();await role('yonetici');await page.setViewportSize({width:1280,height:900});
  console.log('PASS company download single pending POST, transport retry, real signed URL GET200/explicit popup, expiry, missing-object generic error, old success/error role ABA, tab and dismiss/new pending isolation, operasyon/ik signing, mobile');
 }finally{page.off('popup',popupWatch);page.off('request',watch);}
}
