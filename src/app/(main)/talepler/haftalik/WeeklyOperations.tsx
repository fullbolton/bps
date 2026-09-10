"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import WeeklyAttendance from "./WeeklyAttendance";
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {EmptyState,PageHeader} from '@/components/ui';
import {isWorkDate} from '@/lib/operations/daily-demand';
import {addDays,weekStart,weeklyTotals,type WeeklyPlan} from '@/lib/operations/weekly-plan';
import type {PilotCompany} from '@/lib/operations/pilot-types';
import {pilotCompaniesAction,pilotWeekAction} from '../gunluk/actions';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date());
const validDay=(d:unknown):d is string=>isWorkDate(d)&&d>='2000-01-01'&&d<='2100-12-31';
const field='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';
const button='rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40';
const dayLabel=(d:string)=>new Intl.DateTimeFormat('tr-TR',{timeZone:'UTC',day:'2-digit',month:'2-digit',weekday:'short'}).format(new Date(d+'T00:00:00Z'));
export default function WeeklyOperations(){
  const {user,role,loading:authLoading}=useAuth(),search=useSearchParams();
  const allowed=role==='yonetici'||role==='operasyon';
  const [companies,setCompanies]=useState<PilotCompany[]>([]),[companyId,setCompanyId]=useState(search.get('firma')??'');
  const [date,setDate]=useState(()=>validDay(search.get('gun'))?search.get('gun')!:today());
  const [plan,setPlan]=useState<WeeklyPlan|null>(null),[loading,setLoading]=useState(false),[exporting,setExporting]=useState(false);
  const [error,setError]=useState(''),[showCancelled,setShowCancelled]=useState(false),[printReady,setPrintReady]=useState(false);
  const sequence=useRef(0),exportLock=useRef(false);
  const start=weekStart(date),end=addDays(start,6);
  const load=useCallback(async()=>{
    const ticket=++sequence.current;setPlan(null);setError('');
    if(authLoading||!allowed||!companyId){setLoading(false);return;}
    setLoading(true);
    try{const r=await pilotWeekAction(companyId,date);if(ticket!==sequence.current)return;if(r.ok)setPlan(r.data);else setError(r.message);}
    catch{if(ticket===sequence.current)setError('Haftalık plan yüklenemedi. Yeniden deneyin.');}
    finally{if(ticket===sequence.current)setLoading(false);}
  },[authLoading,allowed,companyId,date,user?.id]);
  useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
  useEffect(()=>{
    setCompanies([]);if(authLoading||!allowed)return;
    let current=true;
    pilotCompaniesAction().then(r=>{if(!current)return;if(r.ok){setCompanies(r.data);setCompanyId(old=>r.data.some(c=>c.id===old)?old:r.data[0]?.id??'');}else setError(r.message);}).catch(()=>{if(current)setError('Firma listesi yüklenemedi.');});
    return()=>{current=false;};
  },[authLoading,allowed,user?.id]);
  useEffect(()=>{if(printReady){window.print();setPrintReady(false);}},[printReady]);
  const current=plan?.companyId===companyId&&plan.weekStart===start?plan:null;
  const totals=current?weeklyTotals(current.requests):null;
  const rows=current?.requests.filter(r=>showCancelled||r.lifecycle==='active')??[];
  async function prepareOutput(kind:'csv'|'print'){
    if(exportLock.current||!current)return;
    exportLock.current=true;setExporting(true);setError('');
    const ticket=++sequence.current;
    try{
      const r=await pilotWeekAction(companyId,date);
      if(ticket!==sequence.current)return;
      if(!r.ok){setPlan(null);setError(r.message);return;}
      setPlan(r.data);
      if(!r.data.requests.some(row=>showCancelled||row.lifecycle==='active')){setError('Seçili kapsamda talep yok; çıktı oluşturulmadı.');return;}
      if(kind==='print'){setPrintReady(true);return;}
      // A real same-origin attachment response also works in embedded browsers that
      // do not support downloads from a detached Blob URL after an async action.
      const query=new URLSearchParams({company:companyId,date,cancelled:showCancelled?'1':'0'});
      const a=document.createElement('a');a.href=`/api/operations/weekly-export?${query}`;
      document.body.appendChild(a);a.click();a.remove();
    }catch{setPlan(null);setError('Çıktı için güncel veri doğrulanamadı. Yeniden deneyin.');}
    finally{exportLock.current=false;setExporting(false);}
  }
  if(authLoading)return <p role="status">Oturum yükleniyor…</p>;
  if(!allowed)return <EmptyState title="Bu çalışma alanına erişiminiz yok" />;
  return <>
    <style>{'@media print { @page { size: A4 landscape; margin: 12mm; } .weekly-plan-totals { grid-template-columns: repeat(4, minmax(0, 1fr)); break-inside: avoid; } .weekly-plan-report th:nth-child(1) { width: 9%; } .weekly-plan-report th:nth-child(2) { width: 21%; } .weekly-plan-report th:nth-child(3) { width: 17%; } .weekly-plan-report th:nth-child(4), .weekly-plan-report th:nth-child(5), .weekly-plan-report th:nth-child(6) { width: 6%; } .weekly-plan-report th:nth-child(7) { width: 27%; } .weekly-plan-report th:nth-child(8) { width: 8%; } }'}</style>
    <div className="print:hidden"><PageHeader title="Haftalık personel planı" subtitle="Şube ihtiyaçları, atamalar ve haftalık açıklar." />
      <Link className="mb-4 mr-5 inline-block text-sm underline" href={`/talepler/kontrol?firma=${companyId}&gun=${date}`}>Operasyon kontrol listesi</Link>
      <Link className="mb-4 inline-block text-sm underline" href={`/talepler/gunluk?firma=${companyId}&gun=${date}`}>Günlük plana dön</Link>
      <fieldset disabled={exporting} className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">Firma<select className={field} value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Firma seçin</option>{companies.map(c=><option key={c.id} value={c.id}>{c.name}{c.active?'':' (operasyona kapalı)'}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Haftadan bir gün<input className={field} type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={e=>{if(validDay(e.target.value))setDate(e.target.value);}} /></label>
        <button className={button} disabled={!validDay(addDays(date,-7))} onClick={()=>setDate(addDays(date,-7))}>Önceki hafta</button>
        <button className={button} disabled={!validDay(addDays(date,7))} onClick={()=>setDate(addDays(date,7))}>Sonraki hafta</button>
        <button className={button} onClick={()=>setDate(today())}>Bu hafta</button>
        <button className={button} disabled={loading||!companyId} onClick={()=>void load()}>Yenile</button>
        <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)} />İptalleri göster</label>
      </fieldset>
      {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      <div className="mb-4 flex flex-wrap gap-3"><button className={button} disabled={!current||!rows.length||loading||exporting} onClick={()=>void prepareOutput('csv')}>Müşteri listesi indir (CSV)</button><button className={button} disabled={!current||!rows.length||loading||exporting} onClick={()=>void prepareOutput('print')}>Yazdır / PDF</button>{exporting&&<p role="status">Güncel liste doğrulanıyor…</p>}</div>
    </div>
    {loading?<p role="status">Haftalık plan yükleniyor…</p>:!current?<p role="status">{companyId?'Plan doğrulanmadan liste ve çıktı gösterilmez.':'Önce firma seçin.'}</p>:<section aria-label="Haftalık plan" className="weekly-plan-report">
      <h2 className="text-lg font-semibold">{current.companyName} · {start} — {end}</h2>
      <p className="mt-1 text-sm text-slate-600">{showCancelled?'İptaller dahil':'Aktif talepler'} · Veri: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Istanbul'}).format(new Date(current.generatedAt))} (İstanbul)</p>
      <p className="mt-2 text-sm">Planlanan atamalar gösterilir; gerçekleşen mesai veya puantaj değildir.</p>
      <div className="weekly-plan-totals my-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Aktif talep',totals!.requests],['İhtiyaç (kişi-gün)',totals!.required],['Atanan (kişi-gün)',totals!.assigned],['Açık (kişi-gün)',totals!.open]].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-3"><p className="text-sm text-slate-600">{label}</p><p className="text-2xl font-semibold">{value}</p></div>)}</div>
      <p className="mb-3 text-sm text-slate-600">{totals!.cancelled} iptal talep toplamların dışında. Aynı personelin farklı günlerdeki atamaları ayrı kişi-gün sayılır.</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 print:grid-cols-7">{Array.from({length:7},(_,i)=>addDays(start,i)).map(day=>{const t=weeklyTotals(current.requests.filter(r=>r.workDate===day));return <Link key={day} className="rounded-lg border bg-white p-3 text-sm print:no-underline" href={`/talepler/gunluk?firma=${companyId}&gun=${day}`}><strong>{dayLabel(day)}</strong><p>{t.assigned}/{t.required} atama</p><p>{t.open} açık</p></Link>;})}</div>
      {!rows.length?<EmptyState title="Bu kapsamda talep yok" />:<div className="overflow-x-auto rounded-xl border bg-white print:overflow-visible print:border-0"><table className="w-full min-w-[850px] text-left text-sm print:min-w-0 print:table-fixed print:break-words print:text-xs"><caption className="sr-only">{current.companyName} haftalık personel listesi</caption><thead className="bg-slate-50"><tr>{['Gün','Şube / İl','Hizmet / Pozisyon','İhtiyaç','Atanan','Açık','Personel','Durum'].map(h=><th key={h} scope="col" className="p-3 print:p-1">{h}</th>)}</tr></thead><tbody>{rows.flatMap(r=>Array.from({length:Math.max(1,Math.ceil(r.assignments.length/12))},(_,part)=>{
        const names=r.assignments.slice(part*12,(part+1)*12).map(a=>a.name).join(', ');
        return <tr key={`${r.id}:${part}`} className={`${part?'hidden print:table-row ':''}border-t align-top print:break-inside-avoid`}>
          <td className="p-3 print:p-1">{dayLabel(r.workDate)}</td>
          <td className="p-3 print:p-1"><p>{r.locationName}</p><p className="text-slate-500">{r.city}</p>{part>0&&<p>Personel listesi devamı</p>}</td>
          <td className="p-3 print:p-1"><p>{r.serviceLine}</p><p>{r.position}</p></td>
          <td className="p-3 print:p-1">{part?'—':r.requiredCount}</td>
          <td className="p-3 print:p-1">{part?'—':r.assignments.length}</td>
          <td className="p-3 print:p-1">{part||r.lifecycle==='cancelled'?'—':r.requiredCount-r.assignments.length}</td>
          <td className="max-w-72 break-words p-3 print:p-1"><span className="print:hidden">{r.assignments.length?r.assignments.map(a=>a.name).join(', '):'Atama yok'}</span><span className="hidden print:inline">{names||'Atama yok'}</span></td>
          <td className="p-3 print:p-1">{r.lifecycle==='cancelled'?'İptal':'Aktif'}</td>
        </tr>;
      }))}</tbody></table></div>}
    </section>}
    {companyId&&<WeeklyAttendance key={`${user?.id}:${companyId}:${date}`} companyId={companyId} date={date} />}
  </>;
}
