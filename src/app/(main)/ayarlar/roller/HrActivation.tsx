'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {loadHrActivation,prepareHrActivation,saveHrActivation,hrActivationChecklist} from '@/lib/services/hr-access-activation';
import {hrWriteFailure} from '@/lib/services/hr-write-failure';
const button='min-h-11 rounded-lg border px-4 py-2 disabled:opacity-50';
export default function HrActivation({actor,tenant,onPending,onSaved}:{actor:string;tenant:string;onPending:(value:boolean)=>void;onSaved:()=>Promise<void>}){
 const load=useCallback(()=>loadHrActivation(createClient(),actor,tenant),[actor,tenant]);
 const resource=useScopedResource(`${actor}:${tenant}:activation`,load);
 const [intent,setIntent]=useState<ReturnType<typeof prepareHrActivation>|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [rejected,setRejected]=useState(false);
 const flight=useRef(false),alive=useRef(true),guard=useNavigationGuard();
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{onPending(!!intent);return()=>onPending(false);},[intent,onPending]);
 useEffect(()=>{if(!intent)return;const off=guard.register(e=>{e.preventDefault();setMessage('Önce geçiş onayını tamamlayın veya kapatın.');});const stop=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',stop);return()=>{off();window.removeEventListener('beforeunload',stop);};},[intent,guard]);
 async function save(){if(!intent||flight.current||rejected)return;flight.current=true;setBusy(true);try{await saveHrActivation(createClient(),intent);if(!alive.current)return;setIntent(null);setUncertain(false);setMessage('Geçiş kaydedildi. Güncel erişim durumu yeniden kontrol ediliyor.');await Promise.all([resource.reload(),onSaved()]);}catch(error){if(alive.current){if(hrWriteFailure(error,uncertain)==='rejected'){setRejected(true);setMessage('Geçiş yapılmadı. Onaydan sonra koşullar değişmiş olabilir. Onayı kapatıp güncel ön kontrolü inceleyin.');}else{setUncertain(true);setMessage('Sonuç doğrulanamadı. Aynı işlemi yeniden deneyin veya onayı kapatıp ön kontrolü yenileyin.');}}}finally{flight.current=false;if(alive.current)setBusy(false);}}
 const data=resource.data;
 return <section className="space-y-4 rounded-xl border p-4" aria-label="İK özel yetki geçişi"><h2 className="text-lg font-semibold">İK özel yetkilerini devreye al</h2>
 <p>Geçişten sonra çalışan erişimi özel rollere göre belirlenir. Şirket yöneticilerinin yönetim erişimi korunur. Finans erişimi bu işlemle değişmez.</p>
 <button className={button} disabled={!!intent||busy} onClick={()=>void resource.reload()}>Ön kontrolü yenile</button>
 {message&&<p role="status">{message}</p>}{resource.loading&&<p role="status">Üyelikler ve rol atamaları kontrol ediliyor…</p>}{resource.error&&<p role="alert">Ön kontrol alınamadı. Geçiş yapılamaz; yeniden deneyin.</p>}
 {data&&<><p>{data.mode==='scoped'?'Özel İK yetkileri devrede.':'Mevcut rol sistemi kullanılıyor.'}</p>
 <section aria-label="İK geçiş hazırlığı" className="space-y-2"><h3 className="font-semibold">Geçiş için gerekenler</h3><ul className="space-y-2">{hrActivationChecklist(data).map(item=><li key={item.key} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.label}</strong><span className={item.ready?'text-green-700':'text-amber-800'}>{item.ready?'Hazır':'Tamamlanmalı'}</span></div><p className="mt-1 text-sm">{item.detail}</p></li>)}</ul><p role="status">{data.mode==='scoped'?'Geçiş tamamlandı. Özel roller çalışan erişiminde uygulanıyor.':data.canActivate?'Hazırlık tamam. Hesapların erişim durumunu inceleyip geçişi onaylayabilirsiniz.':'Geçiş kapalı. Yukarıdaki eksikleri tamamladıktan sonra ön kontrolü yenileyin.'}</p></section>
 <p className="text-sm text-slate-600">Bu liste rol ataması kontrolüdür. Görülebilen çalışanlar departman, iş yeri, ret kuralları ve süreli istisnalara göre değişir; bir görme kuralı tüm çalışanları görebileceği anlamına gelmez.</p>
 <ul className="space-y-2">{data.members.map(m=><li key={m.accountId} className="rounded-lg border p-3"><strong>{m.name}</strong> · {m.role==='yonetici'?'Yönetim erişimi korunur':!m.policyAssigned?'Özel rol atanmamış; geçişten sonra çalışan erişimi yok':m.permanentReadRule?'Özel rol atanmış; kayıt kapsamı kurallara göre belirlenir':'Özel rol var; kalıcı çalışan görme kuralı yok'}</li>)}</ul>
 {!intent&&data.mode!=='scoped'&&<button className={button} disabled={!data.canActivate||resource.loading||!!resource.error} onClick={()=>{setMessage('');setIntent(prepareHrActivation(actor,tenant,crypto.randomUUID(),data));}}>Geçişi gözden geçir</button>}
 {intent&&<div className="space-y-3 rounded-xl border-2 border-blue-300 p-4"><h3 className="font-semibold">Şirketin İK erişim kuralları değişecek</h3><p>Yukarıdaki {data.members.length} hesabın erişimi bu modele göre uygulanacak. Veriler silinmez. Ön kontrolden sonra üyelikler veya kurallar değişirse işlem durdurulur.</p><button className={button} disabled={busy||rejected} onClick={()=>void save()}>{busy?'Kaydediliyor…':uncertain?'Aynı işlemi yeniden dene':'Özel İK yetkilerini devreye al'}</button><button className={button} disabled={busy} onClick={()=>{setIntent(null);setUncertain(false);setRejected(false);setMessage('');void resource.reload();}}>Onayı kapat ve yenile</button></div>}</>}
 </section>;
}
