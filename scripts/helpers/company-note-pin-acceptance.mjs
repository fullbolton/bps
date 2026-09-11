import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkCompanyNotePin({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),ids=[randomUUID(),randomUUID()],names=[prefix+'-pin-first',prefix+'-pin-second'];
 for(let i=0;i<2;i++)sql(`INSERT INTO notes(id,tenant_id,company_id,author_id,author_name,content) VALUES('${ids[i]}','${tenant}','${company}','${user}','Synthetic pin acceptance','${names[i]}')`);
 const pattern='**/rest/v1/notes?*',path=origin+'/qa-company-scope/'+company;
 const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}),tab=tabs.getByRole('button',{name:'Notlar',exact:true});
 const section=page.getByRole('heading',{name:'Firma Notları',exact:true}).locator('..').locator('..');
 const pin=(i,name='Sabitle')=>section.getByText(names[i],{exact:true}).locator('..').locator('..').getByRole('button',{name,exact:true});
 const status=section.getByText('Notun sabitleme durumu kaydediliyor…',{exact:true});
 const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Pin signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 const fail=route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"SYNTHETIC_PIN_INTERNAL_ERROR"}'});
 await page.goto(path);await tab.click();await pin(0).waitFor();
 let arrived,unlock,patches=0;const arrival=new Promise(r=>arrived=r),gate=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{if(route.request().method()==='PATCH'){patches++;arrived();await gate;}await route.fallback();};await page.route(pattern,held);await pin(0).focus();await page.keyboard.press('Enter');await signal(arrival);await status.waitFor();
 assert.ok(await pin(0).isDisabled());assert.ok(await pin(1).isDisabled());assert.equal(await pin(0).getAttribute('aria-busy'),'true');
 await page.setViewportSize({width:390,height:844});await section.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-note-pin-pending-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 unlock();await page.getByText('Not sabitlendi.',{exact:true}).waitFor();await pin(0,'Sabitlemeyi kaldır').waitFor();await status.waitFor({state:'hidden'});assert.equal(patches,1);assert.equal(sql(`SELECT is_pinned FROM notes WHERE id='${ids[0]}'`),'t');await page.unroute(pattern,held);
 // Failed write unlocks and leaves the list available.
 const patchFailure=async route=>route.request().method()==='PATCH'?fail(route):route.fallback();await page.route(pattern,patchFailure);await pin(0,'Sabitlemeyi kaldır').click();await section.getByText('Notun sabitleme durumu değiştirilemedi. Tekrar deneyin.',{exact:true}).waitFor();await status.waitFor({state:'hidden'});assert.ok(await pin(0,'Sabitlemeyi kaldır').isEnabled());assert.ok(await pin(1).isEnabled());assert.equal(await page.getByText(/SYNTHETIC_PIN_INTERNAL/).count(),0);await page.unroute(pattern,patchFailure);
 // A successful unpin remains success if its following GET fails; retry sends no second write.
 let writes=0;const watch=r=>{if(r.method()==='PATCH'&&new URL(r.url()).pathname==='/rest/v1/notes')writes++;};page.on('request',watch);
 const readFailure=async route=>route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('company_id')==='eq.'+company?fail(route):route.fallback();await page.route(pattern,readFailure);await pin(0,'Sabitlemeyi kaldır').click();await page.getByText('Notun sabitlemesi kaldırıldı.',{exact:true}).waitFor();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();await status.waitFor({state:'hidden'});assert.equal(sql(`SELECT is_pinned FROM notes WHERE id='${ids[0]}'`),'f');await page.unroute(pattern,readFailure);await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await pin(0).waitFor();assert.equal(writes,1);page.off('request',watch);
 await page.setViewportSize({width:1280,height:900});
 // Old completion (success/error) cannot clear a newer pending write after A→B→A.
 for(const mode of ['success','error']) {
  sql(`UPDATE notes SET is_pinned=false WHERE id IN ('${ids[0]}','${ids[1]}')`);await page.reload();await tab.click();await pin(0).waitFor();
  let oldArrived,oldRelease,oldDone,newArrived,newRelease,newDone;
  const oldIncoming=new Promise(r=>oldArrived=r),oldGate=new Promise(r=>oldRelease=r),oldFinished=new Promise(r=>oldDone=r);
  const newIncoming=new Promise(r=>newArrived=r),newGate=new Promise(r=>newRelease=r),newFinished=new Promise(r=>newDone=r);setRelease(()=>{oldRelease();newRelease();});
  const delayed=async route=>{
   const request=route.request(),target=new URL(request.url()).searchParams.get('id');
   if(request.method()==='PATCH'&&target==='eq.'+ids[0]){const response=mode==='success'?await route.fetch():null;oldArrived();await oldGate;if(response)await route.fulfill({response});else await fail(route);oldDone();}
   else if(request.method()==='PATCH'&&target==='eq.'+ids[1]){const response=await route.fetch();newArrived();await newGate;await route.fulfill({response});newDone();}
   else await route.fallback();
  };
  await page.route(pattern,delayed);await pin(0).click();await signal(oldIncoming);await status.waitFor();
  await role('operasyon');await role('yonetici');await tab.click();await pin(1).waitFor();assert.ok(await pin(1).isEnabled());await pin(1).click();await signal(newIncoming);await status.waitFor();
  oldRelease();await signal(oldFinished);await page.waitForTimeout(250);await status.waitFor();assert.ok(await pin(1).isDisabled());assert.equal(await page.getByText('Not sabitlendi.',{exact:true}).count(),0);assert.equal(await section.getByText('Notun sabitleme durumu değiştirilemedi. Tekrar deneyin.',{exact:true}).count(),0);
  newRelease();await signal(newFinished);await status.waitFor({state:'hidden'});await page.getByText('Not sabitlendi.',{exact:true}).waitFor();await pin(1,'Sabitlemeyi kaldır').waitFor();assert.ok(await pin(1,'Sabitlemeyi kaldır').isEnabled());assert.equal(sql(`SELECT is_pinned FROM notes WHERE id='${ids[1]}'`),'t');await page.unroute(pattern,delayed);
 }
 sql(`DELETE FROM notes WHERE company_id='${company}' AND author_id='${user}'`);
 console.log('PASS pin keyboard/pending/all-pin lock/one PATCH, failure unlock, unpin success/read failure separation, mobile and old success/error across real role A→B→A cannot unlock a newer pending write');
}
