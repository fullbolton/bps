'use client';
import {useEffect,useRef,useState} from 'react';
import {talentWorkCopyPageAction} from './actions';
import {workCopyRows,WorkCopyError} from '@/lib/talent/work-copy';
import {loadWorkCopy} from '@/lib/talent/work-copy-pages';
import {writeWorkCopy,downloadWorkbook} from '@/lib/talent/work-copy-writer';
import type {TalentScope} from '@/lib/talent/people';
export default function WorkCopyExport({scope,disabled}:{scope:TalentScope;disabled:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[open,setOpen]=useState(false),generation=useRef(0),flight=useRef(false),controller=useRef<AbortController|null>(null);
 useEffect(()=>{generation.current++;controller.current?.abort();setMessage('');return()=>{generation.current++;controller.current?.abort();};},[scope.actorId,scope.tenantId,disabled]);
 async function download(){
  if(disabled||flight.current)return;
  flight.current=true;setBusy(true);setMessage('Havuz okunuyor…');const ticket=generation.current,abort=new AbortController();controller.current=abort;
  const active=()=>ticket===generation.current&&!abort.signal.aborted;
  try{
   const snapshot=await loadWorkCopy(scope,async cursor=>{const result=await talentWorkCopyPageAction(scope,cursor);if(!result.ok)throw new WorkCopyError(result.message);return result.data;},abort.signal,(done,total)=>{if(active())setMessage(`${done} / ${total} kişi okundu`);});
   if(!active())return;
   if(!snapshot.total){setMessage('Bu şirkette çalışma kopyası oluşturulacak kişi yok.');return;}
   setMessage('Excel hazırlanıyor…');
   const bytes=await writeWorkCopy(workCopyRows(snapshot),abort.signal,()=>new Worker(new URL('../../../lib/talent/work-copy-writer.worker.ts',import.meta.url)));
   if(!active())return;
   downloadWorkbook(bytes,'BPS-personel-calisma-kopyasi.xlsx');
   setMessage(`${snapshot.total} kişilik çalışma kopyası hazırlandı. Ekrandaki filtreler uygulanmadı.`);
  }catch(error){if(ticket===generation.current)setMessage(abort.signal.aborted?'İndirme iptal edildi. Dosya oluşturulmadı.':error instanceof WorkCopyError?error.message:'Çalışma kopyası tamamlanamadı. Eksik dosya verilmedi; yeniden deneyin.');}
  finally{flight.current=false;setBusy(false);if(controller.current===abort)controller.current=null;}
 }
 return <div><button type="button" disabled={disabled||busy} onClick={()=>setOpen(v=>!v)} className="min-h-11 rounded-xl border bg-white px-4 text-sm disabled:opacity-40">Excel çalışma kopyası</button>{open&&<div className="mt-2 max-w-sm rounded-xl border bg-white p-3 text-sm"><p>Bu şirketin tüm havuzundan ad, ikamet ili/ilçesi, meslekler, çalışma bölgeleri, ilk telefon ve ilk e-posta alınır. Meslek ve bölgeler noktalı virgülle ayrılır. Diğer bilgiler BPS’de korunur. Kişi ve şirket kimliği sütunlarını değiştirmeyin.</p><p className="mt-2">En fazla 50.000 kişi ve 10 MB Excel hazırlanabilir. Hazırlanırken havuz değişirse yeniden indirmeniz istenir. Dosya canlı olarak güncellenmez.</p><p className="mt-2">Dosyayı düzenledikten sonra “Excel’den aktar” ile değişiklikleri tek tek inceleyin. Yeni satırda iki kimlik alanını da boş bırakın. Boş hücreler silme işlemi değildir.</p><button type="button" disabled={disabled||busy} className="mt-2 min-h-11 text-blue-700 underline" onClick={()=>void download()}>{busy?'Hazırlanıyor…':'Çalışma kopyasını indir'}</button>{busy&&<button type="button" className="ml-3 min-h-11 underline" onClick={()=>controller.current?.abort()}>İptal et</button>}{message&&<p role="status" className="mt-2">{message}</p>}</div>}</div>;
}
