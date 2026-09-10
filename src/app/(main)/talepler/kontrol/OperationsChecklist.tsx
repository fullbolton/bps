"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {PageHeader,EmptyState} from '@/components/ui';
import {isWorkDate} from '@/lib/operations/daily-demand';
import {filterChecklist,checklistTotals,type ChecklistFilter,type OperationsChecklist as ChecklistData} from '@/lib/operations/operations-checklist';
import type {PilotCompany} from '@/lib/operations/pilot-types';
import {pilotChecklistAction,pilotCompaniesAction} from '../gunluk/actions';
const validDay=(d:unknown):d is string=>isWorkDate(d)&&d>='2000-01-01'&&d<='2100-12-31';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
const field='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
export default function OperationsChecklist(){
  const {user,role,loading:authLoading}=useAuth(),search=useSearchParams();
  const allowed=role==='yonetici'||role==='operasyon';
  const [companies,setCompanies]=useState<PilotCompany[]>([]),[companyId,setCompanyId]=useState(search.get('firma')??'');
  const [date,setDate]=useState(()=>validDay(search.get('gun'))?search.get('gun')!:today());
  const [data,setData]=useState<ChecklistData|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [filter,setFilter]=useState<ChecklistFilter>('all'),[query,setQuery]=useState('');
  const sequence=useRef(0);
  const load=useCallback(async()=>{
    const ticket=++sequence.current;setData(null);setError('');
    if(authLoading||!allowed||!companyId){setLoading(false);return;}
    setLoading(true);
    try{const r=await pilotChecklistAction(companyId,date);if(ticket!==sequence.current)return;if(r.ok)setData(r.data);else setError(r.message);}
    catch{if(ticket===sequence.current)setError('Kontrol listesi yüklenemedi. Yeniden deneyin.');}
    finally{if(ticket===sequence.current)setLoading(false);}
  },[authLoading,allowed,companyId,date,user?.id]);
  useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
  useEffect(()=>{
    setCompanies([]);if(authLoading||!allowed)return;
    let current=true;
    pilotCompaniesAction().then(r=>{if(!current)return;if(r.ok){setCompanies(r.data);setCompanyId(old=>r.data.some(c=>c.id===old)?old:r.data[0]?.id??'');}else setError(r.message);}).catch(()=>{if(current)setError('Firmalar yüklenemedi.');});
    return()=>{current=false;};
  },[authLoading,allowed,user?.id]);
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  const current=data?.companyId===companyId&&data.date===date?data:null;
  const rows=current?filterChecklist(current.items,filter,query):[];
  const totals=current?checklistTotals(current.items):null;
  return <>
    <PageHeader title="Operasyon kontrol listesi" subtitle="Seçili firma ve gün için atama açıkları ve bekleyen bildirimler." />
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/dizin?firma=${companyId}`}>Şube ve personel dizini</Link>
    <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/gunluk?firma=${companyId}&gun=${date}`}>Günlük plana dön</Link>
    <Link className="mb-4 inline-block text-sm underline" href={`/talepler/haftalik?firma=${companyId}&gun=${date}`}>Haftalık plan ve gerçekleşme</Link>
    <div className="mb-4 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3">
      <label className="text-sm">Firma<select className={field} value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Firma seçin</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' (operasyona kapalı)'}</option>)}</select></label>
      <label className="text-sm">İş günü<input className={field} type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e=>{if(validDay(e.target.value))setDate(e.target.value);}} /></label>
      <div className="flex items-end gap-2"><button className="rounded-lg border px-3 py-2 text-sm" onClick={()=>setDate(today())}>Bugün</button><button className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40" disabled={loading||!companyId} onClick={()=>void load()}>Yenile</button></div>
    </div>
    {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {loading?<p role="status">Kontrol listesi yükleniyor…</p>:!current?<p role="status">{companyId?'Veri doğrulanmadan temiz liste gösterilmez.':'Önce firma seçin.'}</p>:<section aria-label="Günlük kontrol sonuçları">
      <h2 className="font-semibold">{current.companyName} · {current.date}</h2>
      <p className="mt-1 text-xs text-slate-600">Veri: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Istanbul'}).format(new Date(current.generatedAt))} (İstanbul)</p>
      <div className="my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['İncelenecek talep',totals!.requests],['Atama açığı (kişi)',totals!.open],['Aktif gelmedi bildirimi',totals!.absent],['Bildirim bekleyen atama',totals!.unreported]].map(([label,n])=><div key={label} className="rounded-xl border bg-white p-3"><p className="text-sm text-slate-600">{label}</p><strong className="text-2xl">{n}</strong></div>)}</div>
      <p className="mb-4 text-sm text-slate-600">Bir talep birden fazla işaret taşıyabilir; bu sayaçlar toplanmaz. İptal talepler ve kaldırılmış atamalar aksiyon listesine girmez.{date>current.asOfDay?' Gelecek günlerde gerçekleşme bildirimi beklenmez.':' Saat/vardiya tanımı olmadığı için bugün bekleyen bildirimler gecikmiş sayılmaz.'}</p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">İşaret<select className={field} value={filter} onChange={e=>setFilter(e.target.value as ChecklistFilter)}><option value="all">Tümü</option><option value="absence">Gelmedi</option><option value="open">Atama açığı</option><option value="unreported">Bildirim bekliyor</option></select></label><label className="text-sm">Şube, il veya pozisyon ara<input className={field} type="search" maxLength={160} value={query} onChange={e=>setQuery(e.target.value)} /></label></div>
      {!current.items.length?<EmptyState title="Bu gün için kontrol işareti yok" description="Seçili firmanın verisi doğrulandı. Bu, mesai veya ücret onayı değildir." />:!rows.length?<EmptyState title="Filtreye uyan kayıt yok" description="Diğer kayıtlar için işareti veya aramayı değiştirin." />:<>
        <p className="mb-3 text-xs text-slate-600">{rows.length} / {current.items.length} talep gösteriliyor. Önce gelmedi, sonra atama açığı, sonra bekleyen bildirim.</p>
        <ul className="space-y-3">{rows.map(r=><li className="rounded-xl border bg-white p-4" key={r.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{r.locationName} · {r.position}</h3><p className="text-sm text-slate-600">{r.city} · {r.serviceLine} · {r.assigned}/{r.required} atama</p></div><Link className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white" href={`/talepler/gunluk?firma=${companyId}&gun=${date}&talep=${r.id}#talep-${r.id}`}>Günlük kaydı aç</Link></div><div className="mt-3 flex flex-wrap gap-2 text-sm">{r.absent>0&&<span className="rounded bg-red-50 px-2 py-1 text-red-800">{r.absent} gelmedi bildirimi</span>}{r.open>0&&<span className="rounded bg-amber-50 px-2 py-1 text-amber-900">{r.open} kişi atama açığı</span>}{r.unreported>0&&<span className="rounded bg-slate-100 px-2 py-1">{r.unreported} atama bildirim bekliyor</span>}</div></li>)}</ul>
      </>}
    </section>}
  </>;
}
