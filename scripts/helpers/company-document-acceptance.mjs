import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkCompanyDocuments({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 for(const [i,status] of ['tam','eksik','suresi_yaklsiyor'].entries())
  sql(`INSERT INTO documents(id,tenant_id,company_id,name,status,created_by) VALUES('${ids[i]}','${tenant}','${company}','${prefix}-doc-${i}','${status}','${user}')`);
 const path=origin+'/qa-company-scope/'+company;
 const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true});
 const general=tabs.getByRole('button',{name:'Genel Bakış',exact:true});
 const documents=tabs.getByRole('button',{name:'Evraklar',exact:true});
 const overview=page.getByRole('heading',{name:'Evrak Takibi',exact:true}).locator('..');
 const section=page.getByRole('heading',{name:'Firma Evraklari',exact:true}).locator('..').locator('..');
 const pattern='**/rest/v1/documents?*';
 const matches=route=>route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('company_id')==='eq.'+company;
 const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Document signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const role=async value=>{
  sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);
  await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));
  await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();
 };
 let writes=0;
 const writeWatch=r=>{if(['PATCH','DELETE'].includes(r.method()))writes++;};
 page.on('request',writeWatch);
 let arrived,unlock;
 const arrival=new Promise(r=>arrived=r),gate=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{
  if(matches(route)){arrived();await gate;await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic document read failure"}'});}
  else await route.fallback();
 };
 await page.route(pattern,held);await page.goto(path);await signal(arrival);await general.click();
 await overview.getByText('Yükleniyor…',{exact:true}).waitFor();
 assert.equal(await overview.getByText('takip gerektiren belge',{exact:true}).count(),0);
 await documents.click();await section.getByText('Yükleniyor…',{exact:true}).waitFor();
 assert.equal(await section.getByText('Belge yok',{exact:true}).count(),0);
 unlock();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();
 await general.click();await overview.getByText('Veri yüklenemedi',{exact:true}).waitFor();
 assert.equal(await overview.getByText('takip gerektiren belge',{exact:true}).count(),0);
 await page.setViewportSize({width:390,height:844});await overview.scrollIntoViewIfNeeded();
 await page.screenshot({path:output+'/company-document-error-390.png'});
 await page.unroute(pattern,held);
 await overview.getByRole('button',{name:'Tekrar dene',exact:true}).click();
 await overview.getByText('2',{exact:true}).waitFor();
 for(const i of [1,2])await overview.getByText(prefix+'-doc-'+i,{exact:true}).waitFor();
 assert.equal(await overview.getByText(prefix+'-doc-0',{exact:true}).count(),0);
 await documents.click();await section.getByText(prefix+'-doc-0',{exact:true}).waitFor();
 await page.setViewportSize({width:1280,height:900});
 // Delay a completed GET through the full A→B→A role cycle. A string-only guard would accept it.
 let reached,release,done,once=false;
 const incoming=new Promise(r=>reached=r),blocked=new Promise(r=>release=r),finished=new Promise(r=>done=r);setRelease(release);
 const late=async route=>{
  if(matches(route)&&!once){once=true;const response=await route.fetch();reached();await blocked;await route.fulfill({response});done();}
  else await route.fallback();
 };
 await page.route(pattern,late);await page.reload();await signal(incoming);
 sql(`UPDATE documents SET status='tam' WHERE id='${ids[1]}'`);
 await role('operasyon');await general.click();await overview.getByText('1',{exact:true}).waitFor();
 await role('yonetici');await general.click();await overview.getByText('1',{exact:true}).waitFor();
 release();await signal(finished);await page.waitForTimeout(300);
 await overview.getByText('1',{exact:true}).waitFor();assert.equal(await overview.getByText('2',{exact:true}).count(),0);
 await page.unroute(pattern,late);
 sql(`UPDATE documents SET status='tam' WHERE id='${ids[2]}'`);
 await page.reload();await general.click();
 await overview.getByText('Kayıtlı belgelerde takip gerektiren durum yok.',{exact:true}).waitFor();
 assert.equal(await page.getByText('Tum evraklar tamam.',{exact:true}).count(),0);
 sql(`DELETE FROM documents WHERE company_id='${company}' AND created_by='${user}'`);
 await page.reload();await general.click();await overview.getByText('Bu firmaya ait belge kaydı yok.',{exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await overview.scrollIntoViewIfNeeded();
 await page.screenshot({path:output+'/company-document-empty-390.png'});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await documents.click();await section.getByText('Belge yok',{exact:true}).waitFor();
 let reads=0;
 const readWatch=r=>{const u=new URL(r.url());if(r.method()==='GET'&&u.pathname==='/rest/v1/documents'&&u.searchParams.get('company_id')==='eq.'+company)reads++;};
 page.on('request',readWatch);await role('goruntuleyici');await page.reload();await general.click();
 await overview.getByText('Erişim kısıtlı — bu rolde evrak görüntülenemez.',{exact:true}).waitFor();
 assert.equal(await overview.getByText('takip gerektiren belge',{exact:true}).count(),0);assert.equal(reads,0);
 page.off('request',readWatch);await role('yonetici');page.off('request',writeWatch);assert.equal(writes,0);
 await page.setViewportSize({width:1280,height:900});
 console.log('PASS documents loading/error/retry across overview and tab, stored-status count, delayed GET through real role A→B→A, honest empty/complete wording, restricted role no GET and mobile without UI writes');
}
