'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {createClient} from '@/lib/supabase/client';
import {parseStartOverview,type StartOverview as Snapshot} from '@/lib/operations/start-overview';

export default function StartOverview({actorId,tenantId,day}:{actorId:string;tenantId:string;day:string}){
 const [refresh,setRefresh]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [result,setResult]=useState<{scope:string;value:Snapshot}|null>(null);
 const scope=JSON.stringify([actorId,tenantId,day]);
 useEffect(()=>{
  let cancelled=false;setResult(null);setError('');setBusy(true);
  void(async()=>{try{
   const response=await createClient().rpc('ops_start_board_filtered',{p_actor_id:actorId,p_tenant_id:tenantId,p_day:day,p_offset:0,p_search:'',p_only_mine:false,p_only_urgent:true});
   if(response.error)throw response.error;
   const value=parseStartOverview(response.data,day);if(!cancelled)setResult({scope,value});
  }catch{if(!cancelled)setError('İşe başlama özeti yüklenemedi. Yeniden deneyin.');}finally{if(!cancelled)setBusy(false);}})();
  return()=>{cancelled=true;};
 },[actorId,tenantId,day,scope,refresh]);
 const data=result?.scope===scope?result.value:null;
 return <section aria-label="İşe başlama özeti" className="border-t border-slate-200 pt-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">İşe Başlama Takibi</h3><button type="button" className="text-sm text-blue-700 disabled:opacity-50" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Takibi yenile</button></div>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:busy||!data?<p role="status" className="text-sm text-slate-500">İşe başlama özeti yükleniyor…</p>:<>
   <p className="text-sm"><strong className={data.total>0?'text-amber-800':'text-slate-900'}>{data.total} atama takip bekliyor</strong><span className="text-slate-600"> · Bu gün toplam {data.dayTotal} atama</span></p>
   <p className="text-xs text-slate-500">Saat/sorumlu eksikleri, arama ve teyit bekleyenler. Kapanmış atamalar gün toplamına dahildir. Son kontrol: <time dateTime={data.at}>{new Date(data.at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</time>.</p>
   {data.dayTotal===0?<p className="text-sm text-slate-600">Bu gün için henüz personel atanmamış.</p>:data.total===0?<p className="text-sm text-slate-600">Son kontrol anında takip gerektiren atama yok.</p>:<>
    <ul className="divide-y divide-slate-100">{data.items.map(item=><li key={item.id} className="py-2 text-sm"><span className="font-medium">{item.worker} · {item.location}</span><span className="block text-slate-600">{item.company} · {item.status}</span></li>)}</ul>
    {data.total>3&&<p className="text-xs text-slate-500">Takip listesindeki ilk 3 kayıt gösteriliyor.</p>}
    <Link className="inline-block text-sm font-medium text-blue-700 hover:underline" href={data.href}>Takip bekleyenleri aç →</Link>
   </>}
  </>}
 </section>;
}
