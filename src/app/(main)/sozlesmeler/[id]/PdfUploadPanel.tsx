'use client';
import {useEffect,useRef,useState} from 'react';
import {parseUploadCommand,parseUploadReceipt,pdfDigest,uploadStorageKey,uploadFailure,MAX_PDF_BYTES,type PdfUploadCommand,type PdfUploadReceipt} from '@/lib/pdf-upload';
import {pdfUploadStatusAction,pdfUploadCancelAction} from './pdf-upload-actions';
interface Props {actorId:string;tenantId:string;contractId:string;document:{id:string;revision:number;title?:string}|null;targetRole?:'main'|'appendix';onPublished:()=>void}
export default function PdfUploadPanel({actorId,tenantId,contractId,document,targetRole='main',onPublished}:Props){
 const [title,setTitle]=useState('');
 const [command,setCommand]=useState<PdfUploadCommand|null>(null),[file,setFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState('');
 const pending=useRef(false),generation=useRef(0),published=useRef(onPublished);published.current=onPublished;
 const key=uploadStorageKey(actorId,tenantId,contractId,targetRole==='main'?'main':document?.id??'new-appendix');
 function reconcile(receipt:PdfUploadReceipt|null,expected:PdfUploadCommand){
  if(!receipt){setMessage('Yükleme henüz sunucuda kayıtlı değil. Aynı dosyayla devam edebilir veya vazgeçebilirsiniz.');return;}
  const parsed=parseUploadReceipt(receipt,expected);
  if(parsed.state==='pending'){setMessage('Yarım kalan yükleme bulundu. Devam etmek için aynı PDF dosyasını seçin.');return;}
  // Never erase a newer command saved by another tab.
  const saved=localStorage.getItem(key);if(saved&&parseUploadCommand(JSON.parse(saved)).commandId===expected.commandId)localStorage.removeItem(key);
  setCommand(null);setFile(null);setMessage(parsed.state==='published'?'PDF yayımlandı. Önceki sürümler geçmişte korunuyor.':'Yüklemeden vazgeçildi.');
  if(parsed.state==='published')published.current();
 }
 useEffect(()=>{
  const current=++generation.current;let active=true;
  (async()=>{
   try{
    const raw=localStorage.getItem(key);
    if(raw){const saved=parseUploadCommand(JSON.parse(raw));if(saved.contractId!==contractId||(saved.targetRole??'main')!==targetRole)throw Error('Kayıt kapsamı eşleşmiyor.');setCommand(saved);
     const result=await pdfUploadStatusAction(actorId,tenantId,saved);if(!active||current!==generation.current)return;
     if(result.ok)reconcile(result.receipt,saved);else setMessage(result.error);
    }
    if(active)setReady(true);
   }catch{if(active)setMessage('Yarım kalan yükleme kaydı okunamadı. Yeni yükleme başlatılmadı. Tarayıcı depolama erişimini kontrol edin.');}
  })();return()=>{active=false;generation.current++;};
  // The parent keys this component by account, tenant and contract.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key]);
 async function run(action:'upload'|'status'|'cancel'){
  if(pending.current||!ready)return;pending.current=true;setBusy(true);setMessage('');const current=generation.current;
  try{
   let expected=command;
   if(action==='upload'){
    if(!file)throw Error('PDF dosyasını seçin.');
    if(file.size>MAX_PDF_BYTES)throw Error('PDF en fazla 10 MB olabilir.');
    const bytes=await file.arrayBuffer(),sha256=await pdfDigest(bytes);
    if(current!==generation.current)return;
    if(!expected){
     // Recheck after hashing: another tab may have saved a command while we waited.
     const raw=localStorage.getItem(key);if(raw)expected=parseUploadCommand(JSON.parse(raw));
     else expected=parseUploadCommand({commandId:crypto.randomUUID(),contractId,expectedDocumentId:document?.id??null,expectedRevision:document?.revision??null,filename:file.name.trim(),byteSize:file.size,sha256,...(targetRole==='appendix'?{targetRole,appendixTitle:document?.title??title.trim()}:{})});
    }
    if(expected.contractId!==contractId||(expected.targetRole??'main')!==targetRole||expected.byteSize!==file.size||expected.sha256!==sha256)throw Error('PDF_UPLOAD_CONTENT');
    const latest=localStorage.getItem(key);
    if(latest&&parseUploadCommand(JSON.parse(latest)).commandId!==expected.commandId)throw Error('PDF_UPLOAD_OTHER_TAB');
    localStorage.setItem(key,JSON.stringify(expected));setCommand(expected);
    const form=new FormData();form.set('command',JSON.stringify(expected));form.set('actorId',actorId);form.set('tenantId',tenantId);form.set('file',file);
    const response=await fetch('/api/contracts/pdf-upload',{method:'POST',body:form,signal:AbortSignal.timeout(90_000)}),result=await response.json();
    if(current!==generation.current)return;
    if(result?.ok!==true){setMessage(typeof result?.error==='string'?result.error:uploadFailure(null).error);return;}
    reconcile(parseUploadReceipt(result.receipt,expected),expected);
   }else if(expected){
    const result=await (action==='status'?pdfUploadStatusAction:pdfUploadCancelAction)(actorId,tenantId,expected);
    if(current!==generation.current)return;
    if(result.ok)reconcile(result.receipt,expected);else setMessage(result.error);
   }
  }catch(error){if(current===generation.current)setMessage(error instanceof Error&&['PDF dosyasını seçin.','PDF en fazla 10 MB olabilir.'].includes(error.message)?error.message:uploadFailure(error).error);}
  finally{if(current===generation.current){pending.current=false;setBusy(false);}}
 }
 const button='rounded border border-slate-300 px-3 py-2 text-sm disabled:opacity-50';
 return <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
  <p className="text-sm text-slate-600">{command?`Yarım kalan yükleme: ${command.filename}`:document?'Yeni PDF güncel sürüm olur; önceki PDF geçmişte korunur.':'PDF dosyasını yükleyin.'} En fazla 10 MB.</p>
  {targetRole==='appendix'&&!document&&<label className="block text-sm font-medium">Ek protokol başlığı<input className="mt-1 block w-full rounded border border-slate-300 p-2" value={command?.appendixTitle??title} disabled={!ready||busy||!!command} maxLength={160} onChange={e=>setTitle(e.target.value)} placeholder="Örn. 2026 ek hizmet protokolü" /></label>}
  <label className="block text-sm font-medium">Sözleşme PDF dosyası<input className="mt-2 block w-full text-sm" type="file" accept="application/pdf,.pdf" disabled={!ready||busy} onChange={e=>{setFile(e.target.files?.[0]??null);e.target.value='';}} /></label>
  {file&&<p className="text-sm">Seçilen: {file.name}</p>}
  <div className="flex flex-wrap gap-2"><button className={button} disabled={!ready||busy||!file||(targetRole==='appendix'&&!document&&!command&&!title.trim())} onClick={()=>void run('upload')}>{busy?'İşleniyor…':command?'Aynı yüklemeyi sürdür':document?'Yeni PDF sürümünü yükle':'PDF yükle'}</button>
   {command&&<><button className={button} disabled={!ready||busy} onClick={()=>void run('status')}>Sonucu kontrol et</button><button className={button} disabled={!ready||busy} onClick={()=>void run('cancel')}>Yüklemeden vazgeç</button></>}
  </div>
  {command&&<p className="text-xs text-slate-500">Sayfa yenilenirse yükleme kaydı korunur. PDF dosyası tarayıcıda saklanmaz; devam etmek için aynı dosyayı yeniden seçin.</p>}
  {message&&<p role="status" className="text-sm text-slate-700">{message}</p>}
 </div>;
}
