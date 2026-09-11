import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
export async function checkDocumentDownload({page,sql,user,tenant,first,prefix,origin,output,admin,ownedStoragePaths,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),ids=[randomUUID(),randomUUID(),randomUUID()],names=[prefix+'-download-a',prefix+'-download-b',prefix+'-no-file'],paths=[company+'/'+prefix+'-a.pdf',company+'/'+prefix+'-b.pdf'];
 for(let i=0;i<2;i++){ownedStoragePaths.push(paths[i]);assert.ifError((await admin.storage.from('documents').upload(paths[i],Buffer.from('%PDF-1.4\n% Synthetic download acceptance\n%%EOF\n'),{contentType:'application/pdf'})).error);}
 for(let i=0;i<3;i++)sql(`INSERT INTO documents(id,company_id,tenant_id,name,category,status,storage_path,created_by) VALUES('${ids[i]}','${company}','${tenant}','${names[i]}','diger','${i===2?'eksik':'tam'}',${i===2?'NULL':"'"+paths[i]+"'"},'${user}')`);
 await page.clock.install();
 const panel=page.getByRole('region',{name:'Evrak indirme',exact:true}),path=origin+'/qa-document-scope';
 const menu=async i=>{await page.getByRole('row').filter({has:page.getByRole('cell',{name:names[i],exact:true})}).getByRole('button',{name:'Satır işlemleri',exact:true}).click();return page.getByRole('button',{name:'Indir',exact:true}).filter({visible:true});};
 const start=async i=>{const action=await menu(i);await action.click();};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 const signal=async p=>{let timer;try{await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Download signal timeout')),20000);})]);}finally{clearTimeout(timer);}};
 const pattern='**/storage/v1/object/sign/documents/**';
 const matches=(r,i)=>r.method()==='POST'&&new URL(r.url()).pathname.endsWith('/documents/'+paths[i]);
 let requests=0,popups=0;const watch=r=>{if(matches(r,0)||matches(r,1))requests++;};const popupWatch=()=>popups++;page.on('request',watch);page.on('popup',popupWatch);
 try {
  await page.goto(path);assert.ok(await(await menu(2)).isDisabled());await page.keyboard.press('Escape');
  let reached,release;const arrival=new Promise(r=>reached=r),blocked=new Promise(r=>release=r);setRelease(release);
  const fail=async route=>{if(matches(route.request(),0)){reached();await blocked;await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic Storage signing failure"}'});}else await route.fallback();};
  await page.route(pattern,fail);await start(0);await signal(arrival);await panel.getByText('Dosya bağlantısı hazırlanıyor…',{exact:true}).waitFor();assert.ok(await(await menu(1)).isDisabled());await page.keyboard.press('Escape');assert.equal(requests,1);release();await panel.getByText('Dosya bağlantısı hazırlanamadı. Tekrar deneyin.',{exact:true}).waitFor();assert.equal(popups,0);await page.getByRole('cell',{name:names[0],exact:true}).waitFor();await page.unroute(pattern,fail);
  await panel.getByRole('button',{name:'Bağlantıyı yeniden hazırla',exact:true}).click();await panel.getByRole('link',{name:'Dosyayı aç',exact:true}).waitFor();assert.equal(requests,2);assert.equal(popups,0);
  // Only the explicit user click opens a new tab; never log a signed URL/token.
  const responsePromise=page.context().waitForEvent('response',{predicate:r=>r.request().method()==='GET'&&new URL(r.url()).pathname.endsWith('/documents/'+paths[0])});const popupPromise=page.waitForEvent('popup');await panel.getByRole('link',{name:'Dosyayı aç',exact:true}).click();const popup=await popupPromise;const response=await responsePromise;assert.equal(response.status(),200);await popup.close();assert.equal(popups,1);
  await page.clock.fastForward(56000);await panel.getByText('Bağlantının süresi doldu. Yeniden hazırlayın.',{exact:true}).waitFor();assert.equal(await panel.getByRole('link').count(),0);
  for(const success of [true,false]){
   await panel.getByRole('button',{name:'Kapat',exact:true}).click();let ready,free,done;const incoming=new Promise(r=>ready=r),waiting=new Promise(r=>free=r),finished=new Promise(r=>done=r);setRelease(free);
   const late=async route=>{if(matches(route.request(),0)){const response=success?await route.fetch():null;ready();await waiting;await route.fulfill(response?{response}:{status:503,contentType:'application/json',body:'{"message":"Late synthetic Storage error"}'});done();}else await route.fallback();};await page.route(pattern,late);await start(0);await signal(incoming);await role('operasyon');await panel.waitFor({state:'hidden'});await role('yonetici');await start(1);await panel.getByRole('link',{name:'Dosyayı aç',exact:true}).waitFor();free();await signal(finished);await page.waitForTimeout(200);await panel.getByText(names[1],{exact:true}).waitFor();assert.equal(await panel.getByText('Dosya bağlantısı hazırlanamadı. Tekrar deneyin.',{exact:true}).count(),0);assert.equal(popups,1);await page.unroute(pattern,late);
  }
  // Dismissed in-flight work must not unlock/replace a subsequent pending operation.
  await panel.getByRole('button',{name:'Kapat',exact:true}).click();const releases=[],arrivals=[],finished=[];const arrivalSignals=[],finishSignals=[];
  for(let i=0;i<2;i++){arrivalSignals[i]=new Promise(r=>arrivals[i]=r);finishSignals[i]=new Promise(r=>finished[i]=r);}
  const hold=async route=>{const i=[0,1].find(i=>matches(route.request(),i));if(i===undefined){await route.fallback();return;}const response=await route.fetch();const gate=new Promise(r=>releases[i]=r);arrivals[i]();await gate;await route.fulfill({response});finished[i]();};setRelease(()=>releases.forEach(r=>r?.()));await page.route(pattern,hold);
  await start(0);await signal(arrivalSignals[0]);await panel.getByRole('button',{name:'Kapat',exact:true}).click();await start(1);await signal(arrivalSignals[1]);releases[0]();await signal(finishSignals[0]);await panel.getByText('Dosya bağlantısı hazırlanıyor…',{exact:true}).waitFor();await panel.getByText(names[1],{exact:true}).waitFor();assert.ok(await(await menu(0)).isDisabled());await page.keyboard.press('Escape');releases[1]();await signal(finishSignals[1]);await panel.getByRole('link',{name:'Dosyayı aç',exact:true}).waitFor();await page.unroute(pattern,hold);
  await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/document-download-ready-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.clock.fastForward(56000);await panel.getByText('Bağlantının süresi doldu. Yeniden hazırlayın.',{exact:true}).waitFor();await page.setViewportSize({width:1280,height:900});
  console.log('PASS download single pending request, pathless disabled, retry without page reload, explicit link GET 200/new tab, 55s expiry, late success/error role A→B→A and dismiss→new pending isolation, mobile; signed URLs never persisted');
 }finally{page.off('request',watch);page.off('popup',popupWatch);}
}
