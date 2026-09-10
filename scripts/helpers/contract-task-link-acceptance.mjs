import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkContractTaskLink({page,sql,user,tenant,first,prefix,origin,output}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);
 assert.equal(sql("SELECT obj_description('public.tasks'::regclass)"),'BPS synthetic task-prefill fixture v1');
 assert.equal(sql("SELECT obj_description('public.contracts'::regclass)"),'BPS synthetic contracts fixture v1');
 const contract=randomUUID(),target=randomUUID(),other=randomUUID(),unrelated=randomUUID();
 const title=prefix+'-'+('UzunGörevBaşlığı'.repeat(7)),otherTitle=prefix+'-other-contract-task',unrelatedTitle=prefix+'-unrelated-task',hiddenQuery=prefix+'-no-match';
 sql(`INSERT INTO contracts(id,tenant_id,company_id,name,created_by) VALUES('${contract}','${tenant}','${company}','${prefix}-linked-contract','${user}');
 INSERT INTO tasks(id,tenant_id,company_id,contract_id,title,source_type,status,created_by) VALUES
 ('${target}','${tenant}','${company}','${contract}','${title}','sozlesme','acik','${user}'),
 ('${other}','${tenant}','${company}','${contract}','${otherTitle}','sozlesme','tamamlandi','${user}'),
 ('${unrelated}','${tenant}','${company}',NULL,'${unrelatedTitle}','manuel','acik','${user}')`);
 const before=sql(`SELECT json_agg(t ORDER BY id) FROM tasks t WHERE id IN ('${target}','${other}','${unrelated}')`);
 await page.goto(origin+'/gorevler');const search=page.getByRole('textbox',{name:'Görev, firma, kişi ara...',exact:true});await search.fill(hiddenQuery);
 await page.getByRole('combobox',{name:'Durum',exact:true}).selectOption('iptal');await page.getByRole('heading',{name:'Bu filtrelerle eşleşen görev yok',exact:true}).waitFor();
 await page.waitForFunction(query=>Object.keys(sessionStorage).filter(k=>k.startsWith('bps:list-view:v1:')).some(k=>JSON.parse(k.slice('bps:list-view:v1:'.length))[0]==='gorevler'&&JSON.parse(sessionStorage.getItem(k)).search===query),hiddenQuery);
 const path=origin+'/sozlesmeler/'+contract,section=page.locator('#isler'),panel=page.getByRole('dialog',{name:'Görev Hızlı Güncelle',exact:true});
 await page.goto(path);const link=section.getByRole('link',{name:title+' görevini aç',exact:true});await link.waitFor();
 assert.equal(await section.getByRole('link').count(),2);assert.equal(await section.getByText(unrelatedTitle,{exact:true}).count(),0);
 assert.equal(await link.getAttribute('href'),'/gorevler?gorev='+target);
 assert.equal(await section.getByRole('link',{name:otherTitle+' görevini aç',exact:true}).getAttribute('href'),'/gorevler?gorev='+other);
 for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:900});await link.scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.left>=0&&r.right<=innerWidth;}));
 }
 await page.setViewportSize({width:390,height:844});await link.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/contract-task-cards-390.png'});
 let writes=0;const watch=r=>{if(['PATCH','DELETE'].includes(r.method()))writes++;};page.on('request',watch);
 await link.focus();await page.keyboard.press('Enter');await panel.getByRole('heading',{name:title,exact:true}).waitFor();await page.waitForURL(origin+'/gorevler');
 assert.equal(await panel.getByLabel('Durum',{exact:true}).inputValue(),'acik');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});assert.equal(await search.inputValue(),hiddenQuery);
 await page.setViewportSize({width:1280,height:900});assert.equal(await page.getByRole('combobox',{name:'Durum',exact:true}).inputValue(),'iptal');
 await page.goBack();await page.waitForURL(path);await section.getByRole('link',{name:otherTitle+' görevini aç',exact:true}).click();await panel.getByRole('heading',{name:otherTitle,exact:true}).waitFor();assert.equal(await panel.getByLabel('Durum',{exact:true}).inputValue(),'tamamlandi');await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});await page.goBack();await page.waitForURL(path);
 // If a visible link becomes stale, its target is reported missing rather than opening another task.
 await link.waitFor();assert.equal(sql(`SELECT json_agg(t ORDER BY id) FROM tasks t WHERE id IN ('${target}','${other}','${unrelated}')`),before);sql(`DELETE FROM tasks WHERE id='${target}' AND created_by='${user}'`);
 await link.click();await page.getByText('Görev bulunamadı veya bu görev için erişiminiz yok.',{exact:true}).waitFor();assert.equal(await panel.count(),0);
 page.off('request',watch);assert.equal(writes,0);assert.equal(sql(`SELECT count(*) FROM tasks WHERE id IN ('${other}','${unrelated}') AND created_by='${user}'`),'2');
 console.log('PASS contract-specific task links, both exact targets despite saved filters, Enter/back, 320/390/1280 long title cards, stale target and no task writes');
}
