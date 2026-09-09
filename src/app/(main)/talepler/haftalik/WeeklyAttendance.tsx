"use client";
import {useRef,useState,useEffect} from 'react';
import Link from 'next/link';
import {addDays,weekStart} from '@/lib/operations/weekly-plan';
import {attendanceTotals,type AttendanceWeek} from '@/lib/operations/weekly-attendance';
import {pilotAttendanceWeekAction} from '../gunluk/actions';
export default function WeeklyAttendance({companyId,date}:{companyId:string;date:string}){
  const [data,setData]=useState<AttendanceWeek|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const seq=useRef(0),lock=useRef(false);
  useEffect(()=>()=>{seq.current++;},[]);
  async function load(){
    if(lock.current)return;lock.current=true;const ticket=++seq.current;setLoading(true);setData(null);setError('');
    try{const r=await pilotAttendanceWeekAction(companyId,date);if(ticket!==seq.current)return;if(r.ok)setData(r.data);else setError(r.message);}
    catch{if(ticket===seq.current)setError('Gerçekleşme yüklenemedi. Yeniden deneyin.');}
    finally{lock.current=false;if(ticket===seq.current)setLoading(false);}
  }
  const totals=data?attendanceTotals(data.requests):null;
  return <section aria-label="Haftalık gerçekleşme" className="my-6 rounded-xl border bg-slate-50 p-4 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Haftalık gerçekleşme</h2><button className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-40" disabled={loading} onClick={()=>void load()}>{data?'Gerçekleşmeyi yenile':'Gerçekleşmeyi getir'}</button></div>
    <p className="mt-2 text-sm text-slate-600">İptal talepler ve kaldırılmış atamaların bildirimleri dahildir. Plan filtresinden bağımsızdır; çalışma saati veya ücret onayı değildir.</p>
    {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    {loading?<p role="status" className="mt-3">Gerçekleşme yükleniyor…</p>:data&&totals?<>
      <p className="mt-2 text-xs text-slate-600">Veri: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'medium',timeZone:'Europe/Istanbul'}).format(new Date(data.generatedAt))} (İstanbul)</p>
      <div className="my-3 grid grid-cols-1 gap-2 sm:grid-cols-3">{[['Geldi (kişi-gün)',totals.present],['Gelmedi bildirimi',totals.absent],['Bildirilmemiş aktif atama',totals.unreported]].map(([label,n])=><div key={label} className="rounded-lg border bg-white p-3"><p className="text-sm">{label}</p><strong className="text-xl">{n}</strong></div>)}</div>
      <p className="text-xs text-slate-600">{totals.cancelledPresent} geldi kaydı iptal edilmiş taleplerde. Gelmedi toplamı bildirim sayısıdır; tekil kişi sayısı değildir. Kaldırılmış, bildirilmemiş atamalar bekleyen sayılmaz.</p>
      {!data.requests.length?<p className="mt-3 text-sm">Bu hafta talep yok.</p>:<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{Array.from({length:7},(_,i)=>addDays(weekStart(date),i)).map(day=>{const t=attendanceTotals(data.requests.filter(r=>r.workDate===day));return <Link className="rounded-lg border bg-white p-3 text-sm" key={day} href={`/talepler/gunluk?firma=${companyId}&gun=${day}`}><strong>{day.slice(8,10)}/{day.slice(5,7)}</strong><p>{t.present} geldi</p><p>{t.absent} gelmedi bildirimi</p><p>{t.unreported} bildirilmedi</p><span className="mt-1 block text-xs underline">Günlük bildirimler</span></Link>;})}</div>}
    </>:<p className="mt-3 text-sm">Özet henüz yüklenmedi.</p>}
  </section>;
}
