import assert from 'node:assert/strict';

export async function checkCompanyNoteForm({page,sql,user,first,prefix,origin,output,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),path=origin+'/qa-company-scope/'+company;
 const tabs=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}),tab=tabs.getByRole('button',{name:'Notlar',exact:true});
 const section=page.getByRole('heading',{name:'Firma Notları',exact:true}).locator('..').locator('..');
 const createDialog=page.getByRole('dialog',{name:/^Not Ekle — /}),editDialog=page.getByRole('dialog',{name:'Notu Düzenle',exact:true});
 const confirmation=page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true});
 const signal=async promise=>{let timer;try{await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Note form signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const open=async text=>{await section.getByRole('button',{name:'Yeni Not',exact:true}).click();if(text!==undefined)await createDialog.getByRole('textbox',{name:'Not *',exact:true}).fill(text);};
 const edit=async text=>{await section.getByText(text,{exact:true}).locator('..').locator('..').getByRole('button',{name:'Notu düzenle',exact:true}).click();};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 await page.goto(path);await tab.click();await section.getByText('Not yok',{exact:true}).waitFor();
 await open();assert.ok(await createDialog.getByRole('textbox',{name:'Not *',exact:true}).evaluate(e=>e===document.activeElement));assert.ok(await createDialog.getByRole('button',{name:'Kaydet',exact:true}).isDisabled());
 await page.keyboard.press('Escape');await createDialog.waitFor({state:'hidden'});assert.equal(await confirmation.count(),0);
 await open('Taslak');await createDialog.getByRole('textbox',{name:'Not *',exact:true}).press('End');await page.keyboard.press('Enter');await page.keyboard.type('İkinci satır');
 assert.equal(await createDialog.getByRole('textbox',{name:'Not *',exact:true}).inputValue(),'Taslak\nİkinci satır');
 await createDialog.getByLabel('Etiket',{exact:true}).selectOption('operasyon');await page.keyboard.press('Escape');await confirmation.getByRole('button',{name:'Vazgeç',exact:true}).click();
 assert.equal(await createDialog.getByRole('textbox',{name:'Not *',exact:true}).inputValue(),'Taslak\nİkinci satır');assert.equal(await createDialog.getByLabel('Etiket',{exact:true}).inputValue(),'operasyon');
 await createDialog.getByRole('button',{name:/penceresini kapat$/}).click();await confirmation.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await createDialog.waitFor({state:'hidden'});
 await open();assert.equal(await createDialog.getByRole('textbox',{name:'Not *',exact:true}).inputValue(),'');await page.keyboard.press('Escape');
 const content=prefix+'-created-note';await open(content);await createDialog.getByLabel('Etiket',{exact:true}).selectOption('operasyon');
 let arrived,unlock,posts=0;const arrival=new Promise(r=>arrived=r),gate=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(content)){posts++;arrived();await gate;}await route.continue();};
 await page.route('**/*',held);await createDialog.getByRole('button',{name:'Kaydet',exact:true}).click();await signal(arrival);
 await createDialog.getByText('Not kaydediliyor, lütfen bekleyin…',{exact:true}).waitFor();assert.ok(await createDialog.getByRole('textbox',{name:'Not *',exact:true}).isDisabled());assert.ok(await createDialog.getByLabel('Etiket',{exact:true}).isDisabled());assert.ok(await createDialog.getByRole('button',{name:/penceresini kapat$/}).isDisabled());
 await page.keyboard.press('Escape');assert.ok(await createDialog.isVisible());await createDialog.click({position:{x:3,y:3}});assert.ok(await createDialog.isVisible());
 unlock();await createDialog.waitFor({state:'hidden'});await page.getByText('Not firmaya eklendi.',{exact:true}).waitFor();await section.getByText(content,{exact:true}).waitFor();assert.equal(posts,1);await page.unroute('**/*',held);
 const note=sql(`SELECT id FROM notes WHERE company_id='${company}' AND content='${content}'`);assert.match(note,/^[a-f0-9-]{36}$/);assert.equal(sql(`SELECT count(*) FROM notes WHERE company_id='${company}' AND content='${content}'`),'1');
 assert.equal(sql(`SELECT tag FROM notes WHERE id='${note}'`),'operasyon');
 // Editing failure retains the draft and hides backend implementation details.
 await edit(content);assert.equal(await editDialog.getByRole('textbox',{name:'Not *',exact:true}).inputValue(),content);await page.keyboard.press('Escape');await editDialog.waitFor({state:'hidden'});assert.equal(await confirmation.count(),0);
 await edit(content);const changed=prefix+'-edited-note';await editDialog.getByRole('textbox',{name:'Not *',exact:true}).fill(changed);await editDialog.getByLabel('Etiket',{exact:true}).selectOption('gorusme');
 const pattern='**/rest/v1/notes?*',failure=route=>route.fulfill({status:503,contentType:'application/json',body:'{"message":"PRIVATE_SCHEMA_DIAGNOSTIC"}'});
 const failedPatch=async route=>route.request().method()==='PATCH'?failure(route):route.fallback();await page.route(pattern,failedPatch);await editDialog.getByRole('button',{name:'Güncelle',exact:true}).click();
 await editDialog.getByText('Not kaydedilemedi. Bilgileriniz korundu; tekrar deneyin.',{exact:true}).waitFor();assert.equal(await editDialog.getByRole('textbox',{name:'Not *',exact:true}).inputValue(),changed);assert.equal(await editDialog.getByLabel('Etiket',{exact:true}).inputValue(),'gorusme');assert.equal(await page.getByText(/PRIVATE_SCHEMA/).count(),0);await page.unroute(pattern,failedPatch);
 // The edit commits once even when its refresh fails. Retrying reads must not repeat the edit.
 let patches=0;const watch=r=>{if(r.method()==='PATCH'&&new URL(r.url()).pathname==='/rest/v1/notes')patches++;};page.on('request',watch);
 const failedRead=async route=>route.request().method()==='GET'&&new URL(route.request().url()).searchParams.get('company_id')==='eq.'+company?failure(route):route.fallback();await page.route(pattern,failedRead);
 await editDialog.getByRole('button',{name:'Güncelle',exact:true}).click();await editDialog.waitFor({state:'hidden'});await page.getByText('Not güncellendi.',{exact:true}).waitFor();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();
 assert.equal(sql(`SELECT content||':'||tag FROM notes WHERE id='${note}'`),changed+':gorusme');await page.unroute(pattern,failedRead);await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await section.getByText(changed,{exact:true}).waitFor();assert.equal(patches,1);page.off('request',watch);
 // A committed response delayed across A→B→A cannot close or announce into a new draft.
 for(const mode of ['create','edit']) {
  const late=prefix+'-late-'+mode;
  if(mode==='create')await open(late);else {await edit(changed);await editDialog.getByRole('textbox',{name:'Not *',exact:true}).fill(late);}
  let reached,release,done;const incoming=new Promise(r=>reached=r),blocked=new Promise(r=>release=r),finished=new Promise(r=>done=r);setRelease(release);
  const handler=async route=>{if(route.request().method()===(mode==='create'?'POST':'PATCH')&&(route.request().postData()??'').includes(late)){const response=await route.fetch();reached();await blocked;await route.fulfill({response});done();}else await route.fallback();};await page.route('**/*',handler);
  await (mode==='create'?createDialog:editDialog).getByRole('button',{name:mode==='create'?'Kaydet':'Güncelle',exact:true}).click();await signal(incoming);
  assert.equal(sql(`SELECT count(*) FROM notes WHERE company_id='${company}' AND content='${late}'`),'1');
  await role('operasyon');await createDialog.waitFor({state:'hidden'});await editDialog.waitFor({state:'hidden'});await role('yonetici');await tab.click();await open('Yeni kapsam taslağı');
  release();await signal(finished);await page.waitForTimeout(250);assert.ok(await createDialog.isVisible());assert.equal(await createDialog.getByRole('textbox',{name:'Not *',exact:true}).inputValue(),'Yeni kapsam taslağı');
  assert.equal(await page.getByText(mode==='create'?'Not firmaya eklendi.':'Not güncellendi.',{exact:true}).count(),0);await page.unroute('**/*',handler);
  await page.keyboard.press('Escape');await confirmation.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();
 }
 await page.setViewportSize({width:390,height:844});await open('Mobil not taslağı');await createDialog.getByLabel('Etiket',{exact:true}).selectOption('genel');await page.screenshot({path:output+'/company-note-draft-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.keyboard.press('Escape');await confirmation.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await section.scrollIntoViewIfNeeded();await page.screenshot({path:output+'/company-note-actions-390.png'});
 for(const button of await section.getByRole('button',{name:'Notu düzenle',exact:true}).all()){const rect=await button.boundingBox();assert.ok(rect&&rect.width>=44&&rect.height>=44);}
 sql(`DELETE FROM notes WHERE company_id='${company}' AND author_id='${user}'`);await page.setViewportSize({width:1280,height:900});
 console.log('PASS note draft focus/multiline/discard, single pending create and saved notice, failed edit retains data, committed edit/read failure separation, delayed committed create/edit across real role A→B→A and mobile 44px actions');
}
