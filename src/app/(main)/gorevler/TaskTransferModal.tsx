'use client';
import {useEffect,useRef,useState} from 'react';
import {ModalShell} from '@/components/ui';
import {transferDirectoryAction,transferPreviewAction,transferSubmitAction} from './transfer-actions';
import type {TransferCommand,TransferDirectory,TransferMember,TransferPreview} from '@/lib/task-transfer';
const name=(p:TransferMember)=>`${p.name?.trim()||'Üyeliği bulunmayan / isimsiz kişi'} · ${p.id.slice(-8)}`;
const field='w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50';
export default function TaskTransferModal({actorId,onClose,onApplied}:{actorId:string;onClose:()=>void;onApplied:()=>void}) {
  const [directory,setDirectory]=useState<TransferDirectory|null>(null);
  const [tenantId,setTenantId]=useState('');
  const [source,setSource]=useState(''),[target,setTarget]=useState('');
  const [preview,setPreview]=useState<TransferPreview|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const [uncertain,setUncertain]=useState(false),[command,setCommand]=useState<TransferCommand|null>(null);
  const [success,setSuccess]=useState<number|null>(null),[remaining,setRemaining]=useState<number|null>(null);
  const pending=useRef(false),generation=useRef(0);
  useEffect(()=>{void loadDirectory();return()=>{generation.current++;pending.current=false;};},[actorId]); // scope changes remount this modal
  async function loadDirectory(){
    if(pending.current)return;
    const g=++generation.current;pending.current=true;setBusy(true);setError(null);
    setPreview(null);setCommand(null);setUncertain(false);setSuccess(null);setRemaining(null);setDirectory(null);setSource('');setTarget('');
    try{const result=await transferDirectoryAction(actorId);if(g!==generation.current)return;
      if(result.ok){setDirectory(result.directory);setTenantId(result.tenantId);}else setError(result.error);
    }catch{if(g===generation.current)setError('Devir listesi alınamadı. Yeniden deneyin.');}
    finally{if(g===generation.current){pending.current=false;setBusy(false);}}
  }
  async function loadPreview(){
    if(pending.current||!source||!target||source===target)return;
    const g=++generation.current;pending.current=true;setBusy(true);setError(null);setPreview(null);setCommand(null);
    try{const result=await transferPreviewAction(actorId,tenantId,source);if(g!==generation.current)return;
      if(result.ok)setPreview(result.preview);else setError(result.error);
    }catch{if(g===generation.current)setError('Önizleme alınamadı. Hiçbir görev devredilmedi.');}
    finally{if(g===generation.current){pending.current=false;setBusy(false);}}
  }
  async function submit(){
    if(pending.current||!preview?.tasks.length)return;
    const g=++generation.current;
    const next=command??{commandId:crypto.randomUUID(),sourceId:source,targetId:target,tasks:preview.tasks.map(({id,revision})=>({id,revision}))};
    pending.current=true;setCommand(next);setBusy(true);setError(null);
    let committed=false;
    try{
      const result=await transferSubmitAction(actorId,tenantId,next);if(g!==generation.current)return;
      if(!result.ok){setError(result.error);setUncertain(result.uncertain);if(!result.uncertain){setPreview(null);setCommand(null);}return;}
      committed=true;
      setSuccess(result.result.moved);setUncertain(false);onApplied();
      // Receipt is a historical result. Only a NEW read can describe work remaining now.
      const fresh=await transferPreviewAction(actorId,tenantId,source);if(g!==generation.current)return;
      if(fresh.ok)setRemaining(fresh.preview.total);else setError('Devir tamamlandı; kalan iş sayısı alınamadı. Listeyi yenileyin.');
    }catch{if(g===generation.current){
      setUncertain(!committed);
      setError(committed?'Devir tamamlandı; kalan işler yüklenemedi. Listeyi yenileyin.':'Son cevap alınamadı. Aynı komutla tekrar deneyebilirsiniz.');
    }}finally{if(g===generation.current){pending.current=false;setBusy(false);}}
  }
  function changeSource(value:string){setSource(value);setPreview(null);setCommand(null);setError(null);if(value===target)setTarget('');}
  const locked=busy||uncertain||success!==null;
  return <ModalShell open onClose={()=>{if(!pending.current)onClose();}} title="Görevleri devret" footer={<>
    <button className="px-4 py-2 text-sm" disabled={busy} onClick={onClose}>Kapat</button>
    {success!==null?<button className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={busy} onClick={()=>void loadDirectory()}>Yeni devir hazırla</button>:
      preview&&preview.tasks.length>0?<button className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={busy} onClick={()=>void submit()}>{busy?'İşleniyor…':uncertain?'Aynı işlemi tekrar dene':`${preview.tasks.length} görevi devret`}</button>:
      <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={busy||!source||!target||source===target} onClick={()=>void loadPreview()}>Önizle</button>}
  </>}>
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Açık, devam eden ve gecikmiş işler taşınır. Tamamlanmış ve iptal edilmiş işler korunur. Bu işlem kişinin erişimini kapatmaz.</p>
      {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
      {uncertain&&<p className="text-sm text-amber-800">Devir tamamlanmış olabilir. Bu pencere açıkken aynı komutla sonucu sorgulayabilirsiniz. Kapatmak işlemi geri almaz.</p>}
      {busy&&!directory&&<p role="status">Devir listesi yükleniyor…</p>}
      {!directory&&!busy&&<button className="text-sm text-blue-700 underline" onClick={()=>void loadDirectory()}>Listeyi yeniden yükle</button>}
      {success!==null?<div role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm">
        <p>{success} görev devredildi. Her görevde atama geçmişi kaydedildi.</p>
        <p>{remaining===null?'Kalan işler kontrol ediliyor veya henüz doğrulanamadı.':`Yeni ölçüm: kaynak kişide ${remaining} aktif görev kaldı.`}</p>
        <p className="mt-2">Bu sayı ölçüm anına aittir; sonradan yeni iş atanabilir.</p>
      </div>:directory&&<>
        {directory.sources.length===0?<p role="status">Devredilecek aktif, kişiye atanmış görev bulunmuyor.</p>:<>
          <label className="block text-sm">Kaynak kişi<select className={field} disabled={locked} value={source} onChange={e=>changeSource(e.target.value)}><option value="">Kişi seçin</option>{directory.sources.map(p=><option key={p.id} value={p.id}>{name(p)} ({p.count} iş)</option>)}</select></label>
          <label className="block text-sm">Hedef kişi<select className={field} disabled={locked} value={target} onChange={e=>{setTarget(e.target.value);setPreview(null);setCommand(null);setError(null);}}><option value="">Kişi seçin</option>{directory.targets.filter(p=>p.id!==source).map(p=><option key={p.id} value={p.id}>{name(p)}</option>)}</select></label>
          <p className="text-xs text-slate-500">Listede isim bulunamayan kişinin kimliğini kontrol edin. Hedefler görev erişimi olan yönetici, operasyon ve İK üyeleridir.</p>
        </>}
        {preview&&<section aria-label="Devir önizlemesi" className="space-y-2">
          <p className="text-sm font-medium">Kaynak kişide {preview.total} aktif iş var. Bu işlemde listelenen {preview.tasks.length} iş devredilecek.</p>
          {preview.total>100&&<p className="text-sm text-amber-800">İlk 100 iş gösteriliyor. Kalan işler için yeni bir devir hazırlayın.</p>}
          {preview.total===0?<p>Devredilecek iş kalmadı. Listeyi yenileyin.</p>:<ul className="max-h-64 overflow-y-auto divide-y rounded border border-slate-200">{preview.tasks.map(t=><li key={t.id} className="px-3 py-2 text-sm"><p className="break-words font-medium">{t.title}</p><p className="text-xs text-slate-500">{t.companyName??'Firma görünmüyor'}</p></li>)}</ul>}
        </section>}
      </>}
    </div>
  </ModalShell>;
}
