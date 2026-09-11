import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkCompanyContractRead({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 assert.equal(sql("SELECT obj_description(to_regclass('public.contracts'))"),'BPS synthetic contracts fixture v1');
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 const names=[prefix+'-active '+ 'Uzun sözleşme kapsamı '.repeat(12),prefix+'-draft',prefix+'-signature'];
 for(const [i,status] of ['aktif','taslak','imza_bekliyor'].entries())
  sql(`INSERT INTO contracts(id,tenant_id,company_id,name,status,start_date,end_date,created_by) VALUES('${ids[i]}','${tenant}','${company}','${names[i]}','${status}','2026-10-01','2027-10-01','${user}')`);
 const path=origin+'/qa-company-scope/'+company;
 const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true});
 const general=tabs.getByRole('button',{name:'Genel Bakış',exact:true});
 const contracts=tabs.getByRole('button',{name:'Sözleşmeler',exact:true});
 const overview=page.getByRole('heading',{name:'Aktif Sözleşmeler',exact:true}).locator('..');
 const section=page.getByRole('heading',{name:'Firma Sözleşmeleri',exact:true}).locator('..');
 const pattern='**/rest/v1/contracts?*';
 const matches=r=>r.method()==='GET'&&new URL(r.url()).pathname==='/rest/v1/contracts'&&new URL(r.url()).searchParams.get('company_id')==='eq.'+company;
 const signal=async p=>{let t;try{await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Contract signal timeout')),20000);})]);}finally{clearTimeout(t);}};
 const role=async value=>{
  sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);
  await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));
  await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();
 };
 let writes=0;
 const writeWatch=r=>{if(new URL(r.url()).pathname==='/rest/v1/contracts'&&['POST','PATCH','DELETE'].includes(r.method()))writes++;};
 page.on('request',writeWatch);
 let arrived,unlock;
 const incoming=new Promise(r=>arrived=r),gate=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{if(matches(route.request())){arrived();await gate;await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic contract read failure"}'});}else await route.fallback();};
 await page.route(pattern,held);await page.goto(path);await signal(incoming);await general.click();
 await overview.getByText('Yükleniyor…',{exact:true}).waitFor();
 assert.equal(await overview.getByText('Aktif sözleşme yok.',{exact:true}).count(),0);
 assert.equal(await overview.getByText(/hazırlık aşamasında/).count(),0);
 await contracts.click();await section.getByText('Yükleniyor…',{exact:true}).waitFor();assert.equal(await section.getByText('Sözleşme yok',{exact:true}).count(),0);
 unlock();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(await section.getByText('Sözleşme yok',{exact:true}).count(),0);
 await general.click();await overview.getByText('Veri yüklenemedi',{exact:true}).waitFor();
 assert.equal(await page.getByText('Synthetic contract read failure',{exact:true}).count(),0);
 await page.unroute(pattern,held);await overview.getByRole('button',{name:'Tekrar dene',exact:true}).click();
 await overview.getByText('2 sözleşme hazırlık aşamasında',{exact:true}).waitFor();
 assert.equal(await overview.getByRole('link').count(),1);
 assert.equal(await overview.getByRole('link').getAttribute('href'),'/sozlesmeler/'+ids[0]);
 await contracts.click();await section.getByRole('link',{name:names[1]+' — sözleşmeyi aç',exact:true}).waitFor();assert.equal(await section.getByRole('link').count(),3);
 await page.setViewportSize({width:390,height:844});await section.scrollIntoViewIfNeeded();
 for(const link of await section.getByRole('link').all())assert.ok((await link.boundingBox()).height>=44);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:output+'/company-contracts-390.png'});
 const target=section.getByRole('link',{name:names[1]+' — sözleşmeyi aç',exact:true});await target.focus();await page.keyboard.press('Enter');
 await page.waitForURL(origin+'/sozlesmeler/'+ids[1]);await page.getByRole('heading',{name:names[1],exact:true}).waitFor();
 await page.goBack();await section.getByRole('link',{name:names[1]+' — sözleşmeyi aç',exact:true}).waitFor();
 await page.setViewportSize({width:1280,height:900});
 for(const failure of [false,true]) {
  let reached,release,done,once=false;
  const arrival=new Promise(r=>reached=r),blocked=new Promise(r=>release=r),finished=new Promise(r=>done=r);setRelease(release);
  const late=async route=>{
   if(matches(route.request())&&!once){once=true;const response=failure?null:await route.fetch();reached();await blocked;await route.fulfill(response?{response}:{status:503,contentType:'application/json',body:'{"message":"Late synthetic contract error"}'});done();}
   else await route.fallback();
  };
  await page.route(pattern,late);await page.reload();await signal(arrival);
  const current=prefix+'-current-'+failure;
  sql(`UPDATE contracts SET name='${current}' WHERE id='${ids[0]}'`);
  await role('operasyon');await general.click();await overview.getByRole('link',{name:current+' — sözleşmeyi aç',exact:true}).waitFor();
  await role('yonetici');await general.click();await overview.getByRole('link',{name:current+' — sözleşmeyi aç',exact:true}).waitFor();
  release();await signal(finished);await page.waitForTimeout(300);
  await overview.getByRole('link',{name:current+' — sözleşmeyi aç',exact:true}).waitFor();assert.equal(await overview.getByText('Veri yüklenemedi',{exact:true}).count(),0);
  await page.unroute(pattern,late);
 }
 sql(`DELETE FROM contracts WHERE id='${ids[0]}' AND created_by='${user}'`);
 await page.reload();await general.click();await overview.getByText('Aktif sözleşme yok.',{exact:true}).waitFor();await overview.getByText('2 sözleşme hazırlık aşamasında',{exact:true}).waitFor();
 sql(`DELETE FROM contracts WHERE company_id='${company}' AND created_by='${user}'`);
 await page.reload();await general.click();await overview.getByText('Bu firmaya ait sözleşme kaydı yok.',{exact:true}).waitFor();
 await contracts.click();await section.getByText('Sözleşme yok',{exact:true}).waitFor();
 for(const restricted of ['muhasebe','goruntuleyici','ik']) {
  let reads=0;const watch=r=>{if(matches(r))reads++;};page.on('request',watch);
  await role(restricted);await page.reload();await general.click();
  if(restricted==='ik') assert.equal(await overview.count(),0);
  else await overview.getByText('Bu rolde sözleşmeler görüntülenemez.',{exact:true}).waitFor();
  if(restricted==='muhasebe'){await contracts.click();await section.getByText('Bu rolde sözleşmeler görüntülenemez.',{exact:true}).waitFor();assert.equal(await section.getByText('Sözleşme yok',{exact:true}).count(),0);}
  else assert.equal(await contracts.count(),0);
  assert.equal(reads,0,restricted+' must not query company contracts');page.off('request',watch);
 }
 await role('yonetici');page.off('request',writeWatch);assert.equal(writes,0,'Contract reads must not write contracts');
 console.log('PASS company contracts loading/error/retry, real active/preparation/empty states, exact keyboard link/back, mobile 44px, delayed success/error through role A→B→A, restricted roles no GET, no contract table writes');
}
