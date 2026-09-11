import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

/** Real UI→server action→dedicated Storage/DB acceptance; every object remains under its own company. */
export async function checkCompanyUploadSuccess({page,sql,user,tenant,first,prefix,origin,output,client,ownedStoragePaths,setRelease}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),contract=randomUUID(),contractName=prefix+'-upload-contract';
 assert.match(company,/^[a-f0-9-]{36}$/);
 sql(`UPDATE companies SET status='aktif' WHERE id='${company}';INSERT INTO contracts(id,tenant_id,company_id,name,status,created_by) VALUES('${contract}','${tenant}','${company}','${contractName}','taslak','${user}')`);
 const path=origin+'/qa-company-scope/'+company;
 const tab=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}).getByRole('button',{name:'Evraklar',exact:true});
 const section=page.getByRole('heading',{name:'Firma Evraklari',exact:true}).locator('..').locator('..');
 const dialog=page.getByRole('dialog',{name:'Belge Yükle',exact:true}),name=dialog.getByRole('textbox',{name:'Belge Adı *',exact:true}),file=dialog.getByLabel('Dosya (PDF) *',{exact:true}),submit=dialog.getByRole('button',{name:'Yükle',exact:true});
 const bytes=Buffer.from('%PDF-1.4\n% Synthetic BPS upload acceptance only\n%%EOF\n');
 const signal=async p=>{let timer;try{await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Storage upload signal timed out')),25000);})]);}finally{clearTimeout(timer);}};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 const open=async title=>{await tab.click();await page.getByRole('button',{name:'Belge Yükle',exact:true}).click();await dialog.waitFor();await name.fill(title);await file.setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:bytes});};
 const rows=title=>JSON.parse(sql(`SELECT coalesce(json_agg(row_to_json(d)),'[]') FROM (SELECT id,company_id,tenant_id,contract_id,name,category,status,validity_date,storage_path,created_by,uploaded_by FROM documents WHERE company_id='${company}' AND name='${title}' AND created_by='${user}') d`));
 const ownPaths=()=>sql(`SELECT name FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${company}/%' ORDER BY name`).split('\n').filter(Boolean);
 const initialObjects=ownPaths().length;
 const verify=async(title,linked=false)=>{
  const data=rows(title);assert.equal(data.length,1);const row=data[0];assert.equal(row.company_id,company);assert.equal(row.tenant_id,tenant);assert.equal(row.created_by,user);assert.equal(row.uploaded_by,'Synthetic UX acceptance');assert.equal(row.contract_id,linked?contract:null);
  assert.match(row.storage_path,new RegExp('^'+company+'/[a-f0-9-]{36}\\.pdf$'));assert.equal(sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name='${row.storage_path}'`),'1');
  if(!ownedStoragePaths.includes(row.storage_path))ownedStoragePaths.push(row.storage_path);
  const download=await client.storage.from('documents').download(row.storage_path);assert.ifError(download.error);assert.deepEqual(Buffer.from(await download.data.arrayBuffer()),bytes);return row;
 };
 try {
  await page.goto(path);await tab.click();
  const title=prefix+'-uploaded';await open(title);const picker=dialog.getByRole('combobox',{name:'Sözleşme dosyaları',exact:true});await picker.selectOption(contract);assert.ok(await submit.isDisabled());const handoff=dialog.getByRole('link',{name:'Sözleşme dosyalarını aç (yeni sekme)',exact:true});assert.equal(await handoff.getAttribute('href'),'/sozlesmeler/'+contract+'#belgeler');assert.equal(await handoff.getAttribute('target'),'_blank');const popupPromise=page.waitForEvent('popup');await handoff.click();const popup=await popupPromise;await popup.getByRole('heading',{name:contractName,exact:true}).waitFor();await popup.locator('#belgeler').waitFor();await popup.close();assert.equal(await name.inputValue(),title);await dialog.getByText('Seçilen: synthetic.pdf',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Firma belgesi olarak devam et',exact:true}).click();await dialog.getByRole('combobox',{name:'Kategori',exact:true}).selectOption('operasyon_evraki');await dialog.getByLabel('Geçerlilik (opsiyonel)',{exact:true}).fill('2027-10-01');
  const getPattern='**/rest/v1/documents?*';
  const failedRead=async route=>{if(new URL(route.request().url()).searchParams.get('company_id')==='eq.'+company)await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic post-upload list failure"}'});else await route.fallback();};
  await page.route(getPattern,failedRead);
  let reached,release,posts=0;const incoming=new Promise(r=>reached=r),gate=new Promise(r=>release=r);setRelease(release);
  const held=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(title)){posts++;reached();await gate;await route.continue();}else await route.fallback();};
  await page.route('**/*',held);await name.press('Enter');await signal(incoming);await dialog.getByText('Belge yükleniyor, lütfen bekleyin…',{exact:true}).waitFor();await page.keyboard.press('Enter');await page.keyboard.press('Escape');assert.ok(await dialog.isVisible());release();await dialog.waitFor({state:'hidden'});
  await page.getByText(title+' firmaya yüklendi.',{exact:true}).waitFor();await section.getByText('Veri yüklenemedi',{exact:true}).waitFor();assert.equal(posts,1);const row=await verify(title);assert.equal(row.category,'operasyon_evraki');assert.equal(row.validity_date,'2027-10-01');assert.equal(row.status,'tam');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/company-upload-success-read-error-390.png'});
  await page.unroute(getPattern,failedRead);await section.getByRole('button',{name:'Tekrar dene',exact:true}).click();await section.getByText(title,{exact:true}).waitFor();assert.equal(posts,1);await verify(title);await page.unroute('**/*',held);await page.setViewportSize({width:1280,height:900});
  // Hold a committed successful action, change role away and back, then open a new draft.
  const lateTitle=prefix+'-late-upload';await open(lateTitle);
  let ready,free,done;const arrival=new Promise(r=>ready=r),blocked=new Promise(r=>free=r),finished=new Promise(r=>done=r);setRelease(free);
  const late=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(lateTitle)){const response=await route.fetch();ready();await blocked;await route.fulfill({response});done();}else await route.fallback();};
  await page.route('**/*',late);await submit.click();await signal(arrival);await verify(lateTitle);
  await role('operasyon');await dialog.waitFor({state:'hidden'});await role('yonetici');await open('Yeni yükleme taslağı');free();await signal(finished);await page.waitForTimeout(300);assert.equal(await name.inputValue(),'Yeni yükleme taslağı');assert.equal(await page.getByText(lateTitle+' firmaya yüklendi.',{exact:true}).count(),0);await verify(lateTitle);await page.unroute('**/*',late);
  await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true}).getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();
  for(const value of ['yonetici','operasyon','ik']) {
   await role(value);const title=prefix+'-'+value;await open(title);
   if(value!=='yonetici')assert.ok(await dialog.getByRole('combobox',{name:'Sözleşme dosyaları',exact:true}).isDisabled());
   // Tamper only this synthetic action's multipart payload to exercise the server boundary.
   const before=ownPaths().length;let tampered=false;
   const tamper=async route=>{
    const request=route.request(),body=request.postData()??'';
    if(request.method()==='POST'&&body.includes(title)){
     const field=body.match(/name="([^"]*)company_id"/);assert.ok(field);
     const boundary=request.headers()['content-type'].match(/boundary=(.+)$/)?.[1];assert.ok(boundary);
     const addition='--'+boundary+'\r\nContent-Disposition: form-data; name="'+field[1]+'contract_id"\r\n\r\n'+contract+'\r\n';
     // Put the argument field before React's model reference is decoded.
     tampered=true;await route.continue({postData:addition+body});
    }else await route.fallback();
   };
   await page.route('**/*',tamper);await submit.click();await dialog.getByText('Sözleşmeye bağlı belgeleri sözleşme sayfasındaki Dosyalar bölümünden yükleyin.',{exact:true}).waitFor();assert.ok(tampered);assert.equal(ownPaths().length,before);assert.equal(rows(title).length,0);await page.unroute('**/*',tamper);
   await submit.click();await dialog.waitFor({state:'hidden'});await page.getByText(title+' firmaya yüklendi.',{exact:true}).waitFor();await section.getByText(title,{exact:true}).waitFor();await verify(title);
  }
  await role('yonetici');assert.equal(ownPaths().length,initialObjects+5);
  // Actual UI removal of an unlinked document clears its row and object.
  await tab.click();await section.getByRole('button',{name:lateTitle+' — kalıcı olarak sil',exact:true}).click();await page.getByRole('dialog',{name:'Belgeyi kalıcı olarak sil',exact:true}).getByRole('button',{name:'Kalıcı olarak sil',exact:true}).click();await page.getByText(lateTitle+' belge kaydı silindi.',{exact:true}).waitFor();assert.equal(rows(lateTitle).length,0);assert.equal(ownPaths().length,initialObjects+4);
  console.log('PASS real company PDF upload: one POST/row/object, tenant/company/author/category/date/contract metadata and downloaded bytes, success+read error/retry without rewrite, late committed success through role A→B→A, manager/operasyon/ik forged contract rejected before Storage then unlinked upload, UI delete row+object');
 } finally {
  // Even a failure before UI success can leave an object: collect ONLY this run-owned company's prefix.
  for(const path of ownPaths())if(!ownedStoragePaths.includes(path))ownedStoragePaths.push(path);
  sql(`DELETE FROM contracts WHERE id='${contract}' AND company_id='${company}' AND created_by='${user}'`);
 }
}
