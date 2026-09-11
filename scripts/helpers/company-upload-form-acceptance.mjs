import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

/** Form/read/error acceptance only. Invalid PDF magic guarantees action rejection before Storage. */
export async function checkCompanyUploadForm({page,sql,user,tenant,first,prefix,origin,output,setRelease}) {
 assert.equal(sql("SELECT obj_description(to_regclass('public.contracts'))"),'BPS synthetic contracts fixture v1');
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`),contract=randomUUID(),title=prefix+'-contract';
 sql(`UPDATE companies SET status='aktif' WHERE id='${company}';INSERT INTO contracts(id,tenant_id,company_id,name,status,created_by) VALUES('${contract}','${tenant}','${company}','${title}','taslak','${user}')`);
 const documentCount=()=>sql(`SELECT count(*) FROM documents WHERE company_id='${company}' AND created_by='${user}'`);
 const objectCount=()=>sql(`SELECT count(*) FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${company}/%'`);
 const initialDocuments=documentCount(),initialObjects=objectCount();
 const path=origin+'/qa-company-scope/'+company;
 const tab=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}).getByRole('button',{name:'Evraklar',exact:true});
 const dialog=page.getByRole('dialog',{name:'Belge Yükle',exact:true}),discard=page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true});
 const name=dialog.getByRole('textbox',{name:'Belge Adı *',exact:true}),file=dialog.getByLabel('Dosya (PDF) *',{exact:true});
 const picker=dialog.getByRole('combobox',{name:'Sözleşme dosyaları',exact:true}),submit=dialog.getByRole('button',{name:'Yükle',exact:true});
 const signal=async p=>{let timer;try{await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Upload signal timed out')),20000);})]);}finally{clearTimeout(timer);}};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 const open=async()=>{await tab.click();await page.getByRole('button',{name:'Belge Yükle',exact:true}).click();await dialog.waitFor();};
 const closeDirty=async()=>{await page.keyboard.press('Escape');await discard.getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();await dialog.waitFor({state:'hidden'});};
 const invalidPdf={name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('Invalid magic; never upload this to Storage.')};
 const pattern='**/rest/v1/contracts?*';
 const matches=r=>r.method()==='GET'&&new URL(r.url()).searchParams.get('company_id')==='eq.'+company;
 let reached,release;
 const arrival=new Promise(r=>reached=r),gate=new Promise(r=>release=r);setRelease(release);
 const hold=async route=>{if(matches(route.request())){reached();await gate;await route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic contract error"}'});}else await route.fallback();};
 await page.route(pattern,hold);await page.goto(path);await signal(arrival);await open();
 assert.ok(await name.evaluate(e=>e===document.activeElement));assert.ok(await submit.isDisabled());
 await dialog.getByText('Sözleşmeler yükleniyor. Sözleşmeye bağlamadan yükleyebilirsiniz.',{exact:true}).waitFor();assert.ok(await picker.isDisabled());
 await name.fill('Korunan taslak');await file.setInputFiles(invalidPdf);assert.ok(await submit.isEnabled());
 release();await dialog.getByRole('button',{name:'Sözleşmeleri yeniden dene',exact:true}).waitFor();assert.ok(await picker.isDisabled());assert.ok(await submit.isEnabled());
 await page.unroute(pattern,hold);await dialog.getByRole('button',{name:'Sözleşmeleri yeniden dene',exact:true}).click();await picker.getByRole('option',{name:title,exact:true}).waitFor({state:'attached'});await picker.selectOption(contract);
 assert.equal(await name.inputValue(),'Korunan taslak');await dialog.getByText('Seçilen: synthetic.pdf',{exact:true}).waitFor();
 await page.keyboard.press('Escape');await discard.waitFor();await discard.getByRole('button',{name:'Vazgeç',exact:true}).click();assert.equal(await picker.inputValue(),contract);
 await closeDirty();await open();assert.equal(await name.inputValue(),'');assert.equal(await file.evaluate(e=>e.files.length),0);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 await open();await name.fill('Dosya doğrulaması');
 for(const [picked,message] of [
  [{name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('text')},'Sadece PDF dosyası yüklenebilir.'],
  [{name:'empty.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(0)},'Boş dosya yüklenemez.'],
  [{name:'large.pdf',mimeType:'application/pdf',buffer:Buffer.alloc(10*1024*1024+1)},"Dosya boyutu 10 MB'dan büyük olamaz."]
 ]){await file.setInputFiles(picked);await dialog.getByText(message,{exact:true}).waitFor();assert.ok(await submit.isDisabled());assert.equal(await file.evaluate(e=>e.files.length),0);}
 await file.setInputFiles(invalidPdf);await picker.selectOption('');
 const pendingName=prefix+'-pending';await name.fill(pendingName);
 let arrived,unlock,posts=0;
 const incoming=new Promise(r=>arrived=r),blocked=new Promise(r=>unlock=r);setRelease(unlock);
 const held=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(pendingName)){posts++;arrived();await blocked;await route.continue();}else await route.fallback();};
 await page.route('**/*',held);await name.press('Enter');await signal(incoming);
 await dialog.getByText('Belge yükleniyor, lütfen bekleyin…',{exact:true}).waitFor();assert.ok(await name.isDisabled());assert.ok(await file.isDisabled());assert.ok(await picker.isDisabled());assert.ok(await dialog.getByRole('button',{name:'Belge Yükle penceresini kapat',exact:true}).isDisabled());
 await page.keyboard.press('Enter');await page.keyboard.press('Escape');assert.ok(await dialog.isVisible());assert.equal(await discard.count(),0);
 unlock();await dialog.getByText('Sadece PDF dosyası yüklenebilir.',{exact:true}).waitFor();assert.equal(posts,1);assert.equal(await name.inputValue(),pendingName);assert.equal(await picker.inputValue(),'');await dialog.getByText('Seçilen: synthetic.pdf',{exact:true}).waitFor();await page.unroute('**/*',held);
 // A transport failure preserves the draft and does not expose an internal exception.
 const transport=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(pendingName))await route.fulfill({status:503,contentType:'text/plain',body:'Synthetic transport internals'});else await route.fallback();};
 await page.route('**/*',transport);await submit.click();await dialog.getByText('Yükleme sonucu alınamadı. Tekrar denemeden önce belge listesini kontrol edin.',{exact:true}).waitFor();assert.equal(await name.inputValue(),pendingName);assert.equal(await dialog.getByText('Synthetic transport internals',{exact:true}).count(),0);await page.unroute('**/*',transport);await closeDirty();
 // Delayed real action rejection must not overwrite a new draft after role A→B→A.
 await open();await name.fill(prefix+'-late');await file.setInputFiles(invalidPdf);
 let ready,free,done;const fetched=new Promise(r=>ready=r),waiting=new Promise(r=>free=r),finished=new Promise(r=>done=r);setRelease(free);
 const late=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(prefix+'-late')){const response=await route.fetch();ready();await waiting;await route.fulfill({response});done();}else await route.fallback();};
 await page.route('**/*',late);await submit.click();await signal(fetched);await role('operasyon');await dialog.waitFor({state:'hidden'});await role('yonetici');await open();await name.fill('Yeni kapsam taslağı');free();await signal(finished);await page.waitForTimeout(300);assert.equal(await name.inputValue(),'Yeni kapsam taslağı');assert.equal(await dialog.getByRole('alert').count(),0);await page.unroute('**/*',late);await closeDirty();
 await role('ik');await open();await dialog.getByText('Bu rolde sözleşme seçilemez. Belge firmaya yüklenir.',{exact:true}).waitFor();assert.ok(await picker.isDisabled());await name.fill('IK taslağı');await file.setInputFiles(invalidPdf);assert.ok(await submit.isEnabled());
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/company-upload-form-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await closeDirty();await role('yonetici');sql(`DELETE FROM contracts WHERE id='${contract}' AND created_by='${user}'`);await page.reload();await open();await dialog.getByText('Bu firmaya ait sözleşme kaydı yok. Belge firmaya yüklenir.',{exact:true}).waitFor();await page.keyboard.press('Escape');
 assert.equal(documentCount(),initialDocuments);
 assert.equal(objectCount(),initialObjects);
 await page.setViewportSize({width:1280,height:900});
 console.log('PASS upload form contract loading/error/retry/empty/restricted, draft/focus/discard, file size/type/empty, Enter/pending single rejected action, transport retention, late error through role A→B→A, mobile; no document/storage writes. Successful upload not covered.');
}
