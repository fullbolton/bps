'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useVerifiedTenant} from '@/hooks/useVerifiedTenant';
import {createClient} from '@/lib/supabase/client';
import {parseDailyDashboard,type DailyDashboard} from '@/lib/daily-dashboard';
import StartOverview from './StartOverview';
export default function DailyOverview(){
 const {user,role}=useAuth(),[refresh,setRefresh]=useState(0),{tenantId,loading}=useVerifiedTenant(refresh);
 const [result,setResult]=useState<{scope:string;value:DailyDashboard}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const allowed=role==='yonetici'||role==='operasyon',actorId=user?.id,scope=`${actorId}:${tenantId}:${role}`;
 useEffect(()=>{let cancelled=false;setResult(null);setError('');setBusy(true);if(loading||!allowed||!actorId)return;
  void(async()=>{try{if(!tenantId)throw Error('scope');const r=await createClient().rpc('daily_dashboard',{p_actor_id:actorId,p_tenant_id:tenantId});if(r.error)throw r.error;const value=parseDailyDashboard(r.data);if(!cancelled)setResult({scope,value});}catch{if(!cancelled)setError('Günlük operasyon özeti yüklenemedi. Yeniden deneyin.');}finally{if(!cancelled)setBusy(false);}})();return()=>{cancelled=true;};
 },[actorId,tenantId,scope,loading,allowed,refresh]);
 if(!allowed||!actorId)return null;const data=result?.scope===scope?result.value:null;
 return <section aria-label="Bugünün operasyonu" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Bugünün operasyonu{data?` · ${data.day.split('-').reverse().join('.')}`:''}</h2><button disabled={busy} onClick={()=>setRefresh(x=>x+1)} type="button" className="min-h-11 rounded-lg border border-slate-200 px-3 text-sm text-blue-700 disabled:opacity-50">Operasyonu yenile</button></div>
 <p className="text-sm text-slate-600">Bugünkü personel ihtiyaçları ve görevlendirmeler. İşe varış teyitlerini aşağıdaki İşe Başlama Takibi bölümünden izleyin.</p>
 {error?<p role="alert" className="text-sm text-red-700">{error}</p>:!data||busy?<p role="status">Günlük plan yükleniyor…</p>:<><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Aktif talep',data.requests],['İstenen personel',data.required],['Atanan personel',data.placed],['Personel açığı',data.missing]].map(([label,n])=><div key={label} className="rounded bg-slate-50 p-3"><dt className="text-sm text-slate-600">{label}</dt><dd className="text-xl font-semibold">{n}</dd></div>)}</dl>
 {data.requests===0?<p className="text-sm text-slate-500">Bugün için aktif talep yok.</p>:data.openRequests===0?<p className="text-sm text-slate-600">Bugünkü taleplerin tamamına personel yerleştirilmiş.</p>:<><h3 className="text-sm font-semibold">Personel bekleyen talepler · {data.openRequests} kayıt</h3><ul className="divide-y">{data.gaps.map(g=><li key={g.id} className="py-3 flex flex-wrap items-start justify-between gap-3"><a href={`/talepler/gunluk?firma=${g.companyId}&gun=${data.day}&talep=${g.id}#talep-${g.id}`} className="min-w-0 flex-1 break-words text-sm text-blue-700 hover:underline">{g.company} · {g.location}<span className="block text-slate-600">{g.position}</span></a><span className="text-sm font-medium text-amber-700 whitespace-nowrap">{g.missing} kişi eksik</span></li>)}</ul>{data.openRequests>5&&<p className="text-xs text-slate-500">En fazla eksiği olan ilk 5 talep gösteriliyor.</p>}</>}
 {tenantId&&<StartOverview actorId={actorId} tenantId={tenantId} day={data.day}/>}
 <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3"><a className="inline-flex min-h-11 items-center rounded-lg bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100" href={`/talepler/ise-baslama?gun=${data.day}`}>İşe Başlama Takibi →</a>
 <a className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm text-blue-700 hover:bg-slate-50" href={`/talepler/gunluk?gun=${data.day}`}>Günlük planı aç →</a></div></>}
 </section>;
}
