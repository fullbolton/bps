import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function checkCompanyUploadRecovery({page,sql,user,first,prefix,origin,output,ownedStoragePaths}) {
 const company=sql(`SELECT id FROM companies WHERE name='${first}' AND created_by='${user}'`);assert.match(company,/^[a-f0-9-]{36}$/);
 sql(`UPDATE companies SET status='aktif' WHERE id='${company}'`);
 const fault='ux_doc_'+randomUUID().replaceAll('-',''),storageFault=fault+'_s';
 const install=()=>sql(`CREATE TRIGGER ${fault} BEFORE INSERT ON documents FOR EACH ROW EXECUTE FUNCTION public.${fault}('${company}','${prefix}-fault-');`);
 sql(`CREATE FUNCTION public.${fault}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN IF NEW.company_id::text=TG_ARGV[0] AND NEW.name LIKE TG_ARGV[1]||'%' THEN RAISE EXCEPTION 'SYNTHETIC_DOCUMENT_METADATA_FAILURE'; END IF; RETURN NEW; END $$;`);install();
 const ownPaths=()=>sql(`SELECT name FROM storage.objects WHERE bucket_id='documents' AND name LIKE '${company}/%'`).split('\n').filter(Boolean);
 const rows=title=>sql(`SELECT count(*) FROM documents WHERE company_id='${company}' AND name='${title}' AND created_by='${user}'`);
 const dialog=page.getByRole('dialog',{name:'Belge Yükle',exact:true}),name=dialog.getByRole('textbox',{name:'Belge Adı *',exact:true}),submit=dialog.getByRole('button',{name:'Yükle',exact:true});
 const file={name:'synthetic.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n% Recovery acceptance\n%%EOF\n')};
 const tab=page.getByRole('navigation',{name:'Sayfa bölümleri',exact:true}).getByRole('button',{name:'Evraklar',exact:true});
 const open=async title=>{await tab.click();await page.getByRole('button',{name:'Belge Yükle',exact:true}).click();await name.fill(title);await dialog.getByLabel('Dosya (PDF) *',{exact:true}).setInputFiles(file);};
 const close=async()=>{await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Kaydedilmemiş değişiklikler',exact:true}).getByRole('button',{name:'Değişiklikleri bırak',exact:true}).click();};
 const role=async value=>{sql(`UPDATE profiles SET role='${value}' WHERE id='${user}'`);await page.evaluate(()=>window.dispatchEvent(new Event('bps-qa-refresh-auth')));await page.getByTestId('acceptance-role').filter({hasText:value}).waitFor();};
 const review=async title=>{await dialog.getByRole('alert').filter({hasText:'Yükleme tamamlanamadı veya sonucu doğrulanamadı.'}).waitFor();await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='alert');assert.ok(await submit.isDisabled());assert.equal(await name.inputValue(),title);await dialog.getByText('Seçilen: synthetic.pdf',{exact:true}).waitFor();assert.equal(await dialog.getByText(/SYNTHETIC_|orphan|storage\.objects/).count(),0);assert.equal(rows(title),'0');};
 try {
  await page.goto(origin+'/qa-company-scope/'+company);
  const title=prefix+'-fault-manager';const before=ownPaths().length;await open(title);await submit.click();await dialog.getByText('Belge kaydedilemedi. Bu denemede yüklenen dosya kaldırıldı; form bilgilerinizi koruduk. Tekrar deneyebilirsiniz.',{exact:true}).waitFor();assert.equal(rows(title),'0');assert.equal(ownPaths().length,before);assert.ok(await submit.isEnabled());assert.equal(await name.inputValue(),title);
  sql(`DROP TRIGGER ${fault} ON documents;`);await submit.click();await dialog.waitFor({state:'hidden'});await page.getByText(title+' firmaya yüklendi.',{exact:true}).waitFor();assert.equal(rows(title),'1');assert.equal(ownPaths().length,before+1);install();
  for(const value of ['operasyon','ik']){
   await role(value);const title=prefix+'-fault-'+value,before=ownPaths().length;await open(title);await submit.click();await review(title);assert.equal(ownPaths().length,before+1);await close();
  }
  await role('yonetici');
  sql(`CREATE FUNCTION public.${storageFault}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$ BEGIN IF OLD.bucket_id='documents' AND OLD.name LIKE TG_ARGV[0]||'/%' THEN RAISE EXCEPTION 'SYNTHETIC_STORAGE_CLEANUP_FAILURE'; END IF; RETURN OLD; END $$; CREATE TRIGGER ${storageFault} BEFORE DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.${storageFault}('${company}');`);
  const failed=prefix+'-fault-cleanup',beforeCleanup=ownPaths().length;await open(failed);await page.setViewportSize({width:390,height:844});await submit.click();await review(failed);assert.equal(ownPaths().length,beforeCleanup+1);await page.screenshot({path:output+'/company-upload-review-390.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await close();await page.setViewportSize({width:1280,height:900});
  // Shared action's review outcome must also lock the general document form.
  await page.goto(origin+'/evraklar');await page.getByRole('button',{name:'Evrak Yukle',exact:true}).click();const general=page.getByRole('dialog',{name:'Evrak Yukle',exact:true});
  await general.locator('select').first().selectOption({label:first});await general.locator('input[type="file"]').setInputFiles(file);const generalTitle=prefix+'-fault-general';await general.getByPlaceholder('Evrak adini girin',{exact:true}).fill(generalTitle);await general.getByRole('button',{name:'Yukle',exact:true}).click();await general.getByText(/Yükleme tamamlanamadı veya sonucu doğrulanamadı/).waitFor();assert.ok(await general.getByRole('button',{name:'Yukle',exact:true}).isDisabled());assert.equal(rows(generalTitle),'0');await general.getByRole('button',{name:'Iptal',exact:true}).click();
  await page.getByRole('button',{name:'Evrak Yukle',exact:true}).click();await general.locator('select').first().selectOption({label:first});await general.locator('input[type="file"]').setInputFiles(file);const transportTitle=prefix+'-transport-general';await general.getByPlaceholder('Evrak adini girin',{exact:true}).fill(transportTitle);
  const transport=async route=>{if(route.request().method()==='POST'&&(route.request().postData()??'').includes(transportTitle))await route.fulfill({status:503,contentType:'text/plain',body:'Synthetic upload transport failure'});else await route.fallback();};
  await page.route('**/*',transport);await general.getByRole('button',{name:'Yukle',exact:true}).click();await general.getByText('Yükleme sonucu alınamadı. Tekrar denemeden önce belge listesini kontrol edin.',{exact:true}).waitFor();assert.ok(await general.getByRole('button',{name:'Yukle',exact:true}).isDisabled());assert.equal(rows(transportTitle),'0');await page.unroute('**/*',transport);await general.getByRole('button',{name:'Iptal',exact:true}).click();
  console.log('PASS live metadata failure: manager verified object cleanup then retry success; operasyon/ik cannot delete and retry locks; cleanup failure retains reference/draft without raw errors; shared general form locks on returned review and transport failure');
 } finally {
  sql(`DROP TRIGGER IF EXISTS ${fault} ON documents;DROP FUNCTION IF EXISTS public.${fault}();DROP TRIGGER IF EXISTS ${storageFault} ON storage.objects;DROP FUNCTION IF EXISTS public.${storageFault}();`);
  for(const path of ownPaths())if(!ownedStoragePaths.includes(path))ownedStoragePaths.push(path);
 }
}
