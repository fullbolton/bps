"use client";
import {useCallback,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {createClient} from '@/lib/supabase/client';
import {listTenants} from '@/lib/services/platform-admin';
import {loadPlatformRights,prepareRightChange,saveRightChange} from '@/lib/services/platform-module-rights';
import {MODULE_CATALOG} from '@/lib/modules/catalog';
const modules=[...MODULE_CATALOG,{key:'hr' as const,name:'İnsan Kaynakları'}];
function RightsEditor({actor,tenant}:{actor:string;tenant:string}){
 const read=useCallback(()=>loadPlatformRights(createClient(),actor,tenant),[actor,tenant]);
 const resource=useScopedResource(`${actor}:${tenant}`,read);
 const [intent,setIntent]=useState<ReturnType<typeof prepareRightChange>|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(false),[success,setSuccess]=useState(false);
 const lock=useRef(false);
 async function confirm(){
  if(!intent||lock.current)return;lock.current=true;setBusy(true);setError(false);
  try{await saveRightChange(createClient(),intent);setIntent(null);setSuccess(true);await resource.reload();}
  catch{setError(true);}finally{lock.current=false;setBusy(false);}
 }
 return <section className="space-y-3" aria-label="Şirket kullanım hakları">
  {resource.loading&&<p role="status">Kullanım hakları yükleniyor…</p>}
  {resource.error&&<p role="alert">Hak bilgileri alınamadı. Yetkinizi ve bağlantınızı kontrol edip yenileyin.</p>}
  <button type="button" disabled={busy} className="min-h-11 rounded border px-3" onClick={()=>{setIntent(null);setError(false);setSuccess(false);void resource.reload();}}>Güncel durumu yenile</button>
  {success&&<p role="status">Kullanım hakkı değişikliği kaydedildi.</p>}
  {resource.data&&<><h3 className="font-semibold">{resource.data.name}</h3>
   <ul className="grid gap-3 sm:grid-cols-2">{modules.map(module=><li key={module.key} className="rounded-xl border p-4">
    <h4 className="font-medium">{module.name}</h4>
    <p className="mt-1 text-sm">{resource.data!.granted[module.key]?'Kullanım hakkı var':'Kullanım hakkı yok'} · {resource.data!.enabled[module.key]?'Modül açık':resource.data!.ready[module.key]?'Modül kapalı':'Modül hazırlanıyor'}</p>
    {resource.data!.enabled[module.key]?<p className="mt-2 text-sm text-slate-500">Hakkı kaldırmadan önce şirket yöneticisi modülü kapatmalı.</p>:<button type="button" disabled={!!intent||busy} className="mt-2 min-h-11 rounded border px-3 disabled:opacity-50" onClick={()=>{setSuccess(false);setError(false);setIntent(prepareRightChange(resource.data!,module.key,crypto.randomUUID()));}}>{resource.data!.granted[module.key]?'Kullanım hakkını kaldır':'Kullanım hakkı ver'}</button>}
   </li>)}</ul>
  </>}
  {intent&&<section className="rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Hak değişikliği onayı">
   <p className="font-medium">{resource.data?.name} · {modules.find(module=>module.key===intent.p_module)?.name}</p>
   <p className="my-2">{intent.p_granted?'Kullanım hakkı verilecek. Modül kendiliğinden açılmaz.':'Kullanım hakkı kaldırılacak. Mevcut kayıtlar silinmez.'} Bu işlem ödeme veya abonelik iptali değildir.</p>
   {error&&<p role="alert">Sonuç doğrulanamadı. Aynı işlemi tekrar kontrol edin veya güncel durumu yenileyin.</p>}
   <button type="button" disabled={busy} onClick={()=>void confirm()} className="min-h-11 rounded bg-blue-600 px-4 text-white disabled:opacity-50">{busy?'Kontrol ediliyor…':error?'Aynı işlemi tekrar kontrol et':'Değişikliği onayla'}</button>
   {!busy&&!error&&<button type="button" onClick={()=>setIntent(null)} className="ml-2 min-h-11 px-3">Vazgeç</button>}
  </section>}
 </section>;
}
export default function PlatformModuleRights(){
 const {user}=useAuth();const [tenant,setTenant]=useState('');
 const read=useCallback(async()=>{
  const client=createClient();const permission=await client.rpc('is_platform_admin');
  if(permission.error||typeof permission.data!=='boolean')throw Error('PERMISSION');
  return {allowed:permission.data,companies:permission.data?await listTenants(client):[]};
 },[]);
 const resource=useScopedResource(user?user.id:null,read);
 if(resource.loading)return <p role="status">Platform yetkisi doğrulanıyor…</p>;
 if(resource.error)return <div role="alert">Platform bilgileri alınamadı. <button type="button" onClick={()=>void resource.reload()} className="min-h-11 underline">Yeniden dene</button></div>;
 if(!resource.data?.allowed)return <p>Bu alan yalnız platform yöneticileri içindir. Şirketinizin modüllerini Modüller bölümünde görebilirsiniz.</p>;
 return <section className="space-y-4"><h2 className="text-lg font-semibold">Şirket modül hakları</h2>
  <p className="text-sm text-slate-600">Şirketlere kullanım hakkı tanımlayın. Hak tahsisi, şirketin modülü açmasından ayrı bir işlemdir.</p>
  <label className="block">Şirket<select className="ml-2 min-h-11 max-w-full rounded border px-3" value={tenant} onChange={event=>setTenant(event.target.value)}><option value="">Şirket seçin</option>{resource.data.companies.map(company=><option key={company.tenant_id} value={company.tenant_id}>{company.name}</option>)}</select></label>
  {!resource.data.companies.length&&<p>Kayıtlı şirket bulunamadı.</p>}
  {user&&resource.data.companies.some(company=>company.tenant_id===tenant)&&<RightsEditor key={`${user.id}:${tenant}`} actor={user.id} tenant={tenant}/>}
 </section>;
}
