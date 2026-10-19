'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {loadHrTransferOptions,saveHrTransfer} from '@/lib/services/hr-transfer-client';
import {mergeHrTransferOptions,prepareHrLocationTransfer} from '@/lib/services/hr-scoped-transfer';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export default function LocationTransfer({actor,tenant,employee,onClose,onSaved}:{actor:string;tenant:string;employee:{id:string;name:string};onClose:()=>void;onSaved:(targetName:string)=>Promise<void>}){
 const read=useCallback(()=>loadHrTransferOptions(createClient(),actor,tenant,employee.id),[actor,tenant,employee.id]);
 const resource=useScopedResource(`${actor}:${tenant}:${employee.id}:transfer`,read);
 const [pages,setPages]=useState<Awaited<ReturnType<typeof read>>|null>(null),[target,setTarget]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [intent,setIntent]=useState<ReturnType<typeof prepareHrLocationTransfer>|null>(null),[uncertain,setUncertain]=useState(false);
 const data=pages??resource.data;const alive=useRef(true),flight=useRef(false),guard=useNavigationGuard();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{const off=guard.register(e=>{e.preventDefault();setMessage('Önce iş yeri değişikliğini tamamlayın veya kapatın.');});const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>{off();window.removeEventListener('beforeunload',stop);};},[guard]);
 async function more(){if(!data||flight.current)return;flight.current=true;setBusy(true);try{const next=await loadHrTransferOptions(createClient(),actor,tenant,employee.id,data.locations.at(-1)?.id);if(alive.current)setPages(mergeHrTransferOptions(data,next));}catch{if(alive.current)setMessage('Hedefler alınamadı veya atama değişti. Paneli kapatıp yeniden açın.');}finally{flight.current=false;if(alive.current)setBusy(false);}}
 function review(){if(!data||!data.locations.some(x=>x.id===target))return;setIntent(prepareHrLocationTransfer(actor,tenant,crypto.randomUUID(),data.policyRevision,{assignmentId:data.assignmentId,expectedRevision:data.assignmentRevision,locationId:target}));}
 async function save(){if(!intent||flight.current)return;flight.current=true;setBusy(true);try{await saveHrTransfer(createClient(),intent,employee.id);if(!alive.current)return;await onSaved(data?.locations.find(x=>x.id===intent.p_payload.locationId)?.name??'Seçilen iş yeri');}catch{if(alive.current){setUncertain(true);setMessage('Sonuç doğrulanamadı. Aynı işlemi yeniden deneyin veya paneli kapatıp güncel atamayı kontrol edin.');}}finally{flight.current=false;if(alive.current)setBusy(false);}}
 return <section aria-label="İş yeri değişikliği" className="max-w-xl space-y-3 rounded-xl border p-5">
 <h2 className="font-semibold">İş yerini değiştir · {employee.name}</h2>
 {message&&<p role="status">{message}</p>}{resource.loading&&<p role="status">Atama ve yetkili iş yerleri kontrol ediliyor…</p>}
 {resource.error&&<p role="alert">Bu atama değiştirilemiyor veya erişiminiz doğrulanamadı. İşlem, önceki bir günde başlamış ve bitiş tarihi olmayan atamalar için kullanılabilir.</p>}
 {data&&<><p>Mevcut iş yeri: <strong>{data.sourceLocationName}</strong></p><p className="text-sm text-slate-600">Yeni atama {data.effectiveOn} tarihinde başlar. Önceki atama bir gün önce sona erer; geçmiş kayıtlar korunur.</p>
 {!data.locations.length?<p>Yetkileriniz kapsamında uygun başka iş yeri bulunmuyor.</p>:<label className="block">Yeni iş yeri<select className="mt-1 min-h-11 w-full rounded-lg border px-3" disabled={busy||!!intent} value={target} onChange={e=>setTarget(e.target.value)}><option value="">İş yeri seçin</option>{data.locations.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
 {data.hasMore&&<button className={button} disabled={busy||!!intent} onClick={()=>void more()}>Diğer iş yerlerini getir</button>}
 {intent?<div className="space-y-3 rounded-lg bg-blue-50 p-3"><p>{employee.name}: {data.sourceLocationName} → <strong>{data.locations.find(x=>x.id===intent.p_payload.locationId)?.name}</strong>. Başlangıç: {data.effectiveOn}.</p><button className={button} disabled={busy} onClick={()=>void save()}>{busy?'Kaydediliyor…':uncertain?'Aynı işlemi yeniden dene':'Onayla ve kaydet'}</button>{!uncertain&&<button className={button} disabled={busy} onClick={()=>setIntent(null)}>Geri dön</button>}</div>:<button className={button} disabled={busy||!target} onClick={review}>Değişikliği gözden geçir</button>}</>}
 <button className={button} disabled={busy} onClick={onClose}>Paneli kapat</button>
 </section>;
}
