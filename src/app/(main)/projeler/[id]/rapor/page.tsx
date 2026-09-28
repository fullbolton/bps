import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import {projectContext} from '@/lib/project-reporting/server';
import {pageOffset} from '@/lib/project-reporting/view';
import {parseMonthlyReport,workDuration} from '@/lib/project-reporting/monthly-view';
import {isUuid} from '@/lib/operations/pilot-validation';
export const dynamic='force-dynamic';
export default async function Report({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params;
 try{
  const q=await searchParams,month=q.ay,offset=pageOffset(q.sayfa);
  if(!isUuid(id)||typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('REPORT_INPUT');
  const {c,scope,canWrite}=await projectContext();
  const result=await c.rpc('reporting_monthly_report',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:id,p_month:month,p_offset:offset});if(result.error)throw result.error;
  const r=parseMonthlyReport(result.data,scope.tenantId,id,month,offset);
  return <div className="space-y-5"><Link className="inline-flex min-h-11 items-center underline" href={`/projeler/${id}`}>← Projeye dön</Link><PageHeader title="Aylık çalışma raporu" subtitle={`${r.name} · ${month.slice(5)} / ${month.slice(0,4)}`}/><p className="text-sm text-slate-600">{r.status==='open'?'Dönem açık; yeni aktarımlarla rakamlar değişebilir.':'Dönem kapalı.'} Burada onaylanan çalışma süreleri gösterilir. Ücret hesabı yapılmaz.</p>
   {r.pending>0&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4">{r.pending} aktarım onay bekliyor. Bu aktarımlar aşağıdaki toplamlara dahil değil.</p>}
   {r.totals.records===0?<section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Bu ay için henüz onaylı çalışma kaydı yok</h2><p className="mt-2 text-sm text-slate-600">Rapor, çalışma dosyası aktarılıp onaylandıktan sonra oluşur.</p></section>:<><dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Çalışma süresi',workDuration(r.totals.minutes)],['Personel',r.totals.people],['Şube',r.totals.branches],['Çalışma kaydı',r.totals.records]].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-2 text-xl font-semibold">{value}</dd></div>)}</dl>
   <section className="min-w-0 rounded-xl border bg-white p-4"><h2 className="font-semibold">Şubelere göre çalışma</h2><p className="my-2 text-sm text-slate-600">Bir personel birden fazla şubede çalışabilir. Üstteki personel sayısında her kişi bir kez sayılır.</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Şube','Personel','Çalışma olan gün','Kayıt','Süre'].map(s=><th key={s} className="whitespace-nowrap p-3">{s}</th>)}</tr></thead><tbody>{r.rows.map(b=><tr key={b.id} className="border-t"><td className="min-w-40 p-3"><Link className="inline-flex min-h-11 items-center underline" href={`/projeler/${id}/rapor/kayitlar?ay=${month}&sube=${b.id}`}>{b.name}</Link></td><td className="p-3">{b.people}</td><td className="p-3">{b.days}</td><td className="p-3">{b.records}</td><td className="whitespace-nowrap p-3">{workDuration(b.minutes)}</td></tr>)}</tbody></table></div><nav aria-label="Şube raporu sayfaları" className="flex gap-4">{offset>0&&<Link className="min-h-11 py-3 underline" href={`?ay=${month}&sayfa=${offset-50}`}>Önceki</Link>}{offset+50<r.totals.branches&&<Link className="min-h-11 py-3 underline" href={`?ay=${month}&sayfa=${offset+50}`}>Sonraki</Link>}</nav></section></>}
   {r.totals.records>0&&<Link className="inline-flex min-h-11 items-center rounded-lg border px-4" href={`/projeler/${id}/rapor/kayitlar?ay=${month}`}>Tüm çalışma kayıtları</Link>}
   {canWrite&&<Link className="inline-flex min-h-11 items-center rounded-lg border px-4" href={`/projeler/${id}/aktarim`}>Aktarımları incele</Link>}
  </div>;
 }catch{return <section className="rounded-xl border bg-white p-5"><h1 className="text-xl font-semibold">Aylık çalışma raporu</h1><p role="alert" className="my-4">Rapor yüklenemedi. Projeden bir rapor dönemi seçerek tekrar deneyin.</p><Link className="inline-flex min-h-11 items-center underline" href={isUuid(id)?`/projeler/${id}`:'/projeler'}>Projeye dön</Link></section>;}
}
