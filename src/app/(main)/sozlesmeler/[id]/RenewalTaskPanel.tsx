'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {renewalLoadAction,renewalCreateAction} from './renewal-actions';
import {validateRenewalCommand,type RenewalCommand} from '@/lib/contract-renewal';
import {formatDateTR} from '@/lib/format-date';
type Loaded=Extract<Awaited<ReturnType<typeof renewalLoadAction>>,{ok:true}>;
const statuses:Record<string,string>={acik:'Açık',devam_ediyor:'Devam ediyor',gecikti:'Gecikti',tamamlandi:'Tamamlandı',iptal:'İptal'};
export default function RenewalTaskPanel({actorId,contractId,onCreated}:{actorId:string;contractId:string;onCreated:()=>void}){
  const [loaded,setLoaded]=useState<Loaded|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [assignee,setAssignee]=useState(''),[date,setDate]=useState(''),[basis,setBasis]=useState('');
  const [retry,setRetry]=useState<RenewalCommand|null>(null),[success,setSuccess]=useState(false);
  const generation=useRef(0),pending=useRef(false);
  const load=useCallback(async()=>{
    const gen=++generation.current;setLoading(true);setError(null);setLoaded(null);
    try{const r=await renewalLoadAction(actorId,contractId);if(gen!==generation.current)return;
      if(!r.ok){setError(r.error);return;}setLoaded(r);setDate(r.snapshot.suggestedDate??'');
    }catch{if(gen===generation.current)setError('Yenileme kaydı yüklenemedi. Yeniden deneyin.');}
    finally{if(gen===generation.current)setLoading(false);}
  },[actorId,contractId]);
  useEffect(()=>{pending.current=false;void load();return()=>{generation.current++;};},[load]);
  async function submit(){
    if(pending.current||!loaded)return;
    let command:RenewalCommand;
    try{command=retry??validateRenewalCommand({commandId:crypto.randomUUID(),contractId,revision:loaded.snapshot.revision,assigneeId:assignee,dueDate:date,basis});}
    catch(e){setError(e instanceof Error?e.message:'Bilgileri kontrol edin.');return;}
    pending.current=true;setBusy(true);setError(null);const gen=generation.current;
    try{const r=await renewalCreateAction(actorId,loaded.tenantId,command);if(gen!==generation.current)return;
      if(!r.ok){setError(r.error);setRetry(r.uncertain?command:null);return;}
      setRetry(null);setSuccess(true);onCreated();await load();
    }catch{if(gen===generation.current){setRetry(command);setError('Sonuç doğrulanamadı. Aynı işlemi tekrar deneyin.');}}
    finally{pending.current=false;if(gen===generation.current||generation.current===gen+1)setBusy(false);}
  }
  const task=loaded?.snapshot.task;
  return <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3" aria-label="Yenileme görevi">
    <div className="flex justify-between items-center"><h2 className="text-sm font-semibold">Yenileme görevi</h2><button type="button" disabled={busy||!!retry||loading} className="text-sm text-blue-700 disabled:opacity-50" onClick={()=>void load()}>Güncelle</button></div>
    {success&&<p role="status" className="text-sm text-green-700">Yenileme görevi kaydedildi.</p>}
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {loading?<p className="text-sm">Yenileme kaydı yükleniyor…</p>:task?<>
      <p className="font-medium">{task.title}</p>
      <div className="text-sm space-y-1"><div>Sorumlu: {task.assigneeId?(task.assigneeName??'Üyeliği doğrulanamayan kişi'):'Atanmamış'}</div><div>Takip tarihi: {task.dueDate?formatDateTR(task.dueDate.slice(0,10)):'Belirlenmemiş'}</div><div>Görev durumu: {statuses[task.status]}</div><div className="whitespace-pre-wrap">Dayanak: {task.basis}</div></div>
      <Link className="inline-block text-sm text-blue-700" href="/gorevler">Görevler ekranında yönet</Link>
      <p className="text-xs text-slate-500">Sorumlu ve tarih görev kaydından okunur. Görevin tamamlanması sözleşmenin yenilendiği anlamına gelmez.</p>
    </>:loaded?<>
      <p className="text-sm text-slate-600">Bu sözleşme için kayıtlı yenileme görevi yok.</p>
      {loaded.snapshot.companyStatus==='pasif'?<p className="text-sm">Firma pasif; yeni takip görevi oluşturulamaz.</p>:loaded.canCreate?<form className="space-y-3" onSubmit={e=>{e.preventDefault();void submit();}}>
        <fieldset disabled={busy||!!retry} className="space-y-3 disabled:opacity-60">
          <label className="block text-sm">Yenileme sorumlusu<select required value={assignee} onChange={e=>setAssignee(e.target.value)} className="mt-1 block w-full rounded border p-2"><option value="">Kişi seçin</option>{loaded.members.map(p=><option key={p.id} value={p.id}>{p.name??'İsimsiz üye'} · {p.id.slice(-6)}</option>)}</select></label>
          <label className="block text-sm">Takip tarihi<input type="date" min="1900-01-01" max="9999-12-31" required value={date} onChange={e=>setDate(e.target.value)} className="mt-1 block rounded border p-2"/></label>
          <label className="block text-sm">Dayanak açıklaması<textarea required rows={3} value={basis} onChange={e=>setBasis(e.target.value)} placeholder="Bu takip tarihini neye göre belirlediniz?" className="mt-1 block w-full rounded border p-2"/></label>
        </fieldset>
        <p className="text-xs text-slate-500">Önerilen tarihi kontrol edin. Bu tarih operasyon takibi içindir; hukuki ihbar veya fesih süresi olarak doğrulanmış değildir.</p>
        {retry&&<p className="text-xs text-amber-700">Sonuç bekleyen işlem korunuyor. Sayfayı yenilerseniz önce mevcut görevi kontrol edin.</p>}
        <button disabled={busy} type="submit" className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{busy?'Kaydediliyor…':retry?'Aynı işlemi tekrar dene':'Yenileme görevi oluştur'}</button>
      </form>:<p className="text-sm">Yeni yenileme görevini yönetici oluşturabilir.</p>}
    </>:null}
  </section>;
}
