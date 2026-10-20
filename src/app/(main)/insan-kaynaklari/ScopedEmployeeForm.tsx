'use client';
import {hrWriteFailure} from '@/lib/services/hr-write-failure';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {loadScopedHrOptions,saveScopedHrEmployee} from '@/lib/services/hr-screen';
import {mergeHrCreateOptions,prepareScopedHrEmployee} from '@/lib/services/hr-scoped-create';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
const input='mt-1 block min-w-0 min-h-11 w-full max-w-full rounded-lg border px-3';
export default function ScopedEmployeeForm({actor,tenant,onSaved,onOpenChange}:{actor:string;tenant:string;onSaved:()=>Promise<void>;onOpenChange:(open:boolean)=>void}){
 const read=useCallback(()=>loadScopedHrOptions(createClient(),actor,tenant),[actor,tenant]);
 const resource=useScopedResource(`${actor}:${tenant}:create-options`,read);
 const [open,setOpen]=useState(false),[pages,setPages]=useState<Awaited<ReturnType<typeof read>>|null>(null),[choice,setChoice]=useState('');
 const [name,setName]=useState(''),[code,setCode]=useState(''),[startsOn,setStartsOn]=useState(''),[position,setPosition]=useState('');
 const [intent,setIntent]=useState<ReturnType<typeof prepareScopedHrEmployee>|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [rejected,setRejected]=useState(false),[uncertain,setUncertain]=useState(false);
 const alive=useRef(true),flight=useRef(false);const guard=useNavigationGuard();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!open)return;const off=guard.register(e=>{e.preventDefault();setMessage('Önce çalışan formunu kaydedin veya kapatın.');});const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>{off();window.removeEventListener('beforeunload',stop);};},[open,guard]);
 function close(){setRejected(false);setUncertain(false);setMessage('');setOpen(false);onOpenChange(false);setPages(null);setChoice('');setName('');setCode('');setStartsOn('');setPosition('');setIntent(null);}
 async function more(){if(!pages||flight.current)return;flight.current=true;setBusy(true);try{const next=await loadScopedHrOptions(createClient(),actor,tenant,pages.options.at(-1)?.key);if(alive.current)setPages(mergeHrCreateOptions(pages,next));}catch{if(alive.current)setMessage('Seçenekler alınamadı veya yetkiler değişti. Formu kapatıp seçenekleri yenileyin.');}finally{flight.current=false;if(alive.current)setBusy(false);}}
 async function save(){if(flight.current||!pages||rejected)return;const selected=pages.options.find(x=>x.key===choice);if(!selected)return;
  let command=intent;try{command??=prepareScopedHrEmployee(actor,tenant,crypto.randomUUID(),pages.policyRevision,{name:name.trim(),code:code.trim(),startsOn,...(selected.departmentId?{departmentId:selected.departmentId,position:position.trim()}:{}),...(selected.locationId?{locationId:selected.locationId}:{})});}catch{setMessage('Ad, personel kodu, tarih ve pozisyonu kontrol edin.');return;}
  setIntent(command);flight.current=true;setBusy(true);setMessage('');
  try{await saveScopedHrEmployee(createClient(),command);if(!alive.current)return;close();setMessage('Çalışan kaydedildi.');await onSaved();}
  catch(error){if(alive.current){if(hrWriteFailure(error,uncertain)==='rejected'){setRejected(true);setMessage('Bu denemede kayıt yapılmadı. Yetki veya seçenekler değişmiş olabilir. Yazdıklarınız korundu; seçenekleri yeniden kontrol edin.');}else{setUncertain(true);setMessage('Kayıt sonucu doğrulanamadı. Çift kayıt oluşturmamak için aynı işlemi yeniden deneyin.');}}}
  finally{flight.current=false;if(alive.current)setBusy(false);}
 }
 async function refreshDraft(){if(flight.current)return;flight.current=true;setBusy(true);try{const next=await read();if(!alive.current)return;setPages(next);if(!next.options.some(x=>x.key===choice))setChoice('');setIntent(null);setRejected(false);setMessage(next.options.length?'Seçenekler güncellendi. Bilgilerinizi ve eşleşmeyi kontrol edip yeniden kaydedin.':'Şu an çalışan ekleyebileceğiniz yetkili eşleşme yok. Yazdıklarınız korundu; şirket yöneticinizle görüşün.');}catch{if(alive.current)setMessage('Güncel yetkiler alınamadı. Yazdıklarınız korunuyor; kayıt kapalı.');}finally{flight.current=false;if(alive.current)setBusy(false);}}
 const selected=pages?.options.find(x=>x.key===choice);
 return <section className="space-y-3">
 {message&&<p role="status">{message}</p>}
 {!open&&<>{resource.loading&&<p role="status">Kayıt yetkileri kontrol ediliyor…</p>}{resource.error&&<p role="alert">Kayıt seçenekleri alınamadı.</p>}
 <div className="flex flex-wrap gap-2">{!!resource.data?.options.length&&<button className={button} onClick={()=>{setPages(resource.data!);setOpen(true);onOpenChange(true);setMessage('');}}>Yeni çalışan</button>}<button className={button} disabled={resource.loading||busy} onClick={()=>void resource.reload()}>Kayıt seçeneklerini yenile</button></div>
 {resource.data&&!resource.data.options.length&&<p className="text-sm text-slate-600">Yetkileriniz kapsamında yeni çalışan eklenebilecek bir departman ve iş yeri eşleşmesi bulunmuyor.</p>}</>}
 {open&&pages&&<form className="max-w-xl space-y-3 rounded-xl border p-5" onSubmit={e=>{e.preventDefault();void save();}}><h2 className="font-semibold">Yeni çalışan</h2>
 <fieldset disabled={busy||!!intent} className="min-w-0 space-y-3">
 <label className="block">Ad soyad<input className={input} required maxLength={160} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label className="block">Personel kodu<input className={input} required maxLength={40} value={code} onChange={e=>setCode(e.target.value)}/></label>
 <label className="block">İşe giriş tarihi<input className={input} type="date" required min="1900-01-01" max="2199-12-31" value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label>
 {!pages.canCreateFuture&&<p className="text-sm text-slate-600">Yetkiniz mevcut departman ve iş yeriyle sınırlı. Gelecek tarihli işe girişleri şirket yöneticisine iletin.</p>}
 <label className="block">Departman ve iş yeri<select required className={input} value={choice} onChange={e=>{setChoice(e.target.value);setPosition('');}}><option value="">Yetkili bir eşleşme seçin</option>{pages.options.map(x=><option key={x.key} value={x.key}>{x.departmentName??'Departman belirlenmedi'} · {x.locationName??'İş yeri belirlenmedi'}</option>)}</select></label>
 {pages.hasMore&&<button type="button" className={button} onClick={()=>void more()}>Diğer seçenekleri getir</button>}
 {selected?.departmentId&&<label className="block">Pozisyon<input required maxLength={120} className={input} value={position} onChange={e=>setPosition(e.target.value)}/></label>}
 </fieldset>{(rejected||(!pages.options.length&&!intent))&&<button type="button" className={button} disabled={busy} onClick={()=>void refreshDraft()}>Yazdıklarımı koruyarak seçenekleri kontrol et</button>}<div className="flex flex-wrap gap-2"><button className={button} disabled={busy||!selected||rejected}>{busy?'Kaydediliyor…':rejected?'Önce seçenekleri kontrol edin':intent?'Aynı işlemi yeniden dene':'Kaydet'}</button><button type="button" className={button} disabled={busy||uncertain} onClick={close}>Formu kapat</button></div></form>}
 </section>;
}
