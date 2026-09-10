'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useVerifiedTenant} from '@/hooks/useVerifiedTenant';
import {createClient} from '@/lib/supabase/client';
import {activityLabel,parseDashboardActivity,type DashboardActivity} from '@/lib/dashboard-activity';

export default function RecentActivities(){
 const [refresh,setRefresh]=useState(0);
 const {user,role,loading:authLoading}=useAuth();
 const actorId=user?.id;const {tenantId,loading:tenantLoading}=useVerifiedTenant(refresh);const loading=authLoading||tenantLoading;
 const allowed=role==='yonetici'||role==='operasyon';
 const scope=`${actorId}:${tenantId}:${role}`;
 const [result,setResult]=useState<{scope:string;rows:DashboardActivity[]}|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(true);
 useEffect(()=>{
  let cancelled=false;setResult(null);setError('');setBusy(true);
  if(loading||!allowed||!actorId)return;
  void (async()=>{
   try{
    if(typeof tenantId!=='string')throw Error('scope');
    const {data,error}=await createClient().rpc('dashboard_activity',{p_actor_id:actorId,p_tenant_id:tenantId});
    if(error)throw error;
    const rows=parseDashboardActivity(data);
    if(!cancelled)setResult({scope,rows});
   }catch{if(!cancelled)setError('Aktiviteler yüklenemedi. Yeniden deneyin.');}
   finally{if(!cancelled)setBusy(false);}
  })();return()=>{cancelled=true;};
 },[actorId,tenantId,scope,allowed,loading,refresh]);
 if(loading||!allowed||!actorId)return null;
 const rows=result?.scope===scope?result.rows:null;
 return <section aria-label="Son aktiviteler" className="rounded-lg border border-slate-200 bg-white p-5">
  <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Son Aktiviteler</h3><button type="button" onClick={()=>setRefresh(x=>x+1)} disabled={busy} className="text-sm text-blue-700 disabled:opacity-50">Aktiviteleri yenile</button></div>
  <p className="mt-1 text-xs text-slate-500">Operasyon ve işe başlama takibi, görev oluşturma ve atamaları, belge yüklemeleri · Son 20 kayıt</p>
  {error?<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>:busy||!rows?<p className="mt-3 text-sm text-slate-500">Aktiviteler yükleniyor…</p>:rows.length===0?<p className="mt-3 text-sm text-slate-500">Henüz bu kapsamda işlem kaydı yok.</p>:<ol tabIndex={0} aria-label="Son 20 işlem" className="mt-3 max-h-96 overflow-y-auto divide-y divide-slate-100">{rows.map(row=><li key={row.id} className="py-3">
   <a href={row.href} className="text-sm text-blue-700 hover:underline">{activityLabel(row.kind)}</a>
   {row.title&&<p className="break-words text-sm text-slate-600">{row.title}</p>}
   <time dateTime={row.at} className="text-xs text-slate-500">{new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(row.at))}</time>
  </li>)}</ol>}
 </section>;
}
