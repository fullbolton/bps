import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkCompanyNotes({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 const ids=Array.from({length:4},()=>randomUUID()),contents=ids.map((_,i)=>prefix+'-note-'+i+(i===0?'x'.repeat(140):''));
 for(let i=0;i<4;i++)sql(`INSERT INTO notes(id,tenant_id,company_id,author_id,author_name,content,tag,is_pinned,created_at) VALUES('${ids[i]}','${tenant}','${company}','${user}','Synthetic author','${contents[i]}','${i===0?'genel':'operasyon'}',${i===0},'2026-09-0${i+1}T09:00:00Z')`);
 const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true});
 const general=tabs.getByRole('button',{name:'Genel Bakış',exact:true}),tab=tabs.getByRole('button',{name:'Notlar',exact:true});
 const overview=page.getByRole('heading',{name:'Son Notlar',exact:true}).locator('..');
 const section=page.getByRole('heading',{name:'Firma Notları',exact:true}).locator('..').locator('..');
 const path=origin+'/qa-company-scope/'+company,pattern='**/rest/v1/notes?*';
 const matches=route=>route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('company_id')==='eq.'+company;
 const fail=route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"INTERNAL notes schema secret diagnostic"}'});
 const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Notes signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 let arrived,unlock;const arrival=new Promise(r=>arrived=r),gate=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{if(matches(route)){arrived();await gate;await fail(route);}else await route.fallback();};
 await page.route(pattern,held);await page.goto(path);await signal(arrival);await general.click();
 await overview.getByText('Yükleniyor…',{exact:true}).waitFor();assert.equal(await overview.getByText('Henüz not yok.',{exact:true}).count(),0);
 await tab.click();await section.getByText('Yükleniyor…',{exact:true}).waitFor();unlock();
 await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await section.getByText('Not yok',{exact:true}).count(),0);
 assert.equal(await page.getByText(/INTERNAL notes/).count(),0);await general.click();await overview.getByText('Veri yüklenemedi',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await overview.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-notes-error-390.png'});
 await page.unroute(pattern,held);await overview.getByRole('button',{name:'Tekrar dene',exact:true}).click();
 for(const i of [0,3,2])await overview.getByText(contents[i],{exact:true}).waitFor();assert.equal(await overview.getByText(contents[1],{exact:true}).count(),0);
 assert.deepEqual(await overview.locator('div.space-y-2 > div > p:first-child').allTextContents(),[contents[0],contents[3],contents[2]]);
 await tab.click();for(const text of contents)await section.getByText(text,{exact:true}).waitFor();
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-notes-list-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.setViewportSize({width:1280,height:900});
 // An old success or error cannot overwrite the refreshed result through real role A→B→A.
 for(const mode of ['success','error']) {
  let reached,release,done,once=false;const incoming=new Promise(r=>reached=r),blocked=new Promise(r=>release=r),finished=new Promise(r=>done=r);setRelease(release);
  const late=async route=>{if(matches(route)&&!once){once=true;const response=mode==='success'?await route.fetch():null;reached();await blocked;if(response)await route.fulfill({response});else await fail(route);done();}else await route.fallback();};
  await page.route(pattern,late);await page.reload();await signal(incoming);
  const next=prefix+'-updated-'+mode;sql(`UPDATE notes SET content='${next}' WHERE id='${ids[3]}'`);
  await role('operasyon');await tab.click();await section.getByText(next,{exact:true}).waitFor();
  await role('yonetici');await tab.click();await section.getByText(next,{exact:true}).waitFor();release();await signal(finished);await page.waitForTimeout(250);
  await section.getByText(next,{exact:true}).waitFor();assert.equal(await section.getByText('Veri yüklenemedi',{exact:true}).count(),0);await page.unroute(pattern,late);
 }
 // A pin write failure keeps the list readable. A successful pin followed by failed read is a read error.
 const pin=section.getByRole('button',{name:'Sabitlemeyi kaldır',exact:true});
 const pinFail=async route=>route.request().method()==='PATCH'?fail(route):route.fallback();await page.route(pattern,pinFail);await pin.click();
 await section.getByText('Notun sabitleme durumu değiştirilemedi. Tekrar deneyin.',{exact:true}).waitFor();await section.getByText(contents[0],{exact:true}).waitFor();
 assert.equal(await section.getByText('Veri yüklenemedi',{exact:true}).count(),0);assert.equal(await page.getByText(/INTERNAL notes/).count(),0);await page.unroute(pattern,pinFail);
 const readFail=async route=>matches(route)?fail(route):route.fallback();await page.route(pattern,readFail);await pin.click();
 await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(sql(`SELECT is_pinned FROM notes WHERE id='${ids[0]}'`),'f');
 assert.equal(await section.getByText('Notun sabitleme durumu değiştirilemedi. Tekrar deneyin.',{exact:true}).count(),0);await page.unroute(pattern,readFail);
 await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await section.getByText(contents[0],{exact:true}).waitFor();assert.equal(await section.getByText('Sabitlenmiş Notlar',{exact:true}).count(),0);
 sql(`DELETE FROM notes WHERE company_id='${company}' AND author_id='${user}'`);await page.reload();await tab.click();await section.getByText('Not yok',{exact:true}).waitFor();
 await general.click();await overview.getByText('Henüz not yok.',{exact:true}).waitFor();
 let reads=0;const watch=r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.pathname==='/rest/v1/notes'&&u.searchParams.get('company_id')==='eq.'+company)reads++;};
 page.on('request',watch);await role('goruntuleyici');await page.reload();await general.click();await page.getByTestId('acceptance-role').filter({hasText:'goruntuleyici'}).waitFor();
 assert.equal(await overview.count(),0);assert.equal(reads,0);page.off('request',watch);await role('yonetici');
 console.log('PASS company notes overview/tab loading, error without raw details/false empty, retry, pinned-first top three, mobile long text, late success/error through real role A→B→A, pin failure/read failure separation, empty state and restricted role no GET');
}
