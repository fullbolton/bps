'use client';
import Link from 'next/link';
import Invitations from './Invitations';
import {useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useVerifiedTenant} from '@/hooks/useVerifiedTenant';
import {createClient} from '@/lib/supabase/client';
import {parseWorkspaceSetup,type WorkspaceSetup as Setup} from '@/lib/workspace-setup';
import {PageHeader} from '@/components/ui';
export default function WorkspaceSetup({operationsEnabled}:{operationsEnabled:boolean}){
 const [refresh,setRefresh]=useState(0);
 const {user,role,loading:authLoading}=useAuth();const actorId=user?.id;
 const {tenantId,loading:tenantLoading}=useVerifiedTenant(refresh);const loading=authLoading||tenantLoading;
 const scope=`${actorId}:${tenantId}:${role}`;
 const [data,setData]=useState<{scope:string;value:Setup}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 useEffect(()=>{let cancelled=false;setData(null);setError('');setBusy(true);
  if(loading||!actorId||role!=='yonetici')return;
  void(async()=>{try{
   if(typeof tenantId!=='string')throw Error('scope');
   const r=await createClient().rpc('workspace_setup',{p_actor_id:actorId,p_tenant_id:tenantId});if(r.error)throw r.error;
   const value=parseWorkspaceSetup(r.data,tenantId);if(!cancelled)setData({scope,value});
  }catch{if(!cancelled)setError('Kurulum bilgileri yüklenemedi. Yeniden deneyin.');}finally{if(!cancelled)setBusy(false);}})();return()=>{cancelled=true;};
 },[loading,actorId,tenantId,role,scope,refresh]);
 if(loading)return <p role="status">Çalışma alanı doğrulanıyor…</p>;
 if(!actorId||role!=='yonetici')return <section><PageHeader title="Çalışma alanı kurulumu"/><p>Bu bölüm çalışma alanı yöneticisine açıktır.</p></section>;
 const value=data?.scope===scope?data.value:null;
 return <><PageHeader title="Çalışma alanı kurulumu" subtitle="Firmanızı, şubelerinizi ve ekibinizi ilk operasyon gününe hazırlayın."/>
 <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
  <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{value?.name??'Çalışma alanınız'}</h2><button disabled={busy} onClick={()=>setRefresh(x=>x+1)} className="text-sm text-blue-700 disabled:opacity-50">Durumu yenile</button></div>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:busy||!value?<p role="status">Kayıtlar kontrol ediliyor…</p>:<>
   <p className="text-sm text-slate-600">Bu liste mevcut kayıtları gösterir. Kayıt bulunması kurulumun veya pilot kontrolünün tamamlandığı anlamına gelmez.</p>
   <ol className="divide-y divide-slate-100">{[
    {title:'Firmaları ekleyin',description:'Hizmet verdiğiniz müşterileri kaydedin.',count:`${value.companies} aktif firma`,href:'/firmalar',button:'Firmalara git',ops:false},
    {title:'Şubeleri toplu aktarın',description:'Her şubeyi tek tek girmek yerine lokasyon listesini içe aktarın.',count:`${value.locations} aktif firmaya bağlı aktif lokasyon`,href:'/talepler/gunluk',button:'Lokasyon aktarımını aç',ops:true},
    {title:'Ekip erişimini gözden geçirin',description:'Mevcut kullanıcıları ve rollerini kontrol edin. Personel dizini, uygulamaya giriş yapan kullanıcı listesinden ayrıdır.',count:`${value.members} çalışma alanı üyesi`,href:'/ayarlar',button:'Kullanıcıları görüntüle',ops:false},
    {title:'Personel dizinini hazırlayın',description:'Yerleştirmede kullanacağınız personeli tanımlayın.',count:`${value.workers} aktif personel`,href:'/talepler/dizin',button:'Personel dizinini aç',ops:true},
    {title:'İlk günlük planı oluşturun',description:`${value.today} ve sonrası için aktif firma ve lokasyonlardaki talepler ile aktif personelin yerleştirmeleri.`,count:`${value.requests} talep · ${value.assignments} yerleştirme`,href:'/talepler/gunluk',button:'Günlük planı aç',ops:true},
    {title:'Haftalık çıktıyı kontrol edin',description:'Firma ve tarih aralığını seçip planı müşteriyle paylaşmadan önce gözden geçirin.',count:'Gözden geçirme kaydı henüz tutulmuyor',href:'/talepler/haftalik',button:'Haftalık planı aç',ops:true},
   ].map((step,i)=><li key={step.title} className="py-4 space-y-2"><h3 className="font-medium">{i+1}. {step.title}</h3><p className="text-sm text-slate-600">{step.description}</p><p className="text-sm font-medium text-slate-800">{step.count}</p>{step.ops&&!operationsEnabled?<p className="text-sm text-slate-500">Günlük operasyon bu ortamda henüz kullanıma açılmadı.</p>:<Link className="inline-block text-sm text-blue-700 hover:underline" href={step.href}>{step.button}</Link>}</li>)}</ol>
  </>}
 </section>{value&&<Invitations key={scope} actorId={actorId} tenantId={value.tenantId}/>}</>;
}
