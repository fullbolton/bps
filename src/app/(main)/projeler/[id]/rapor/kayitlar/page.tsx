import Link from 'next/link';
import {projectContext} from '@/lib/project-reporting/server';
import {pageOffset} from '@/lib/project-reporting/view';
import {workDuration} from '@/lib/project-reporting/monthly-view';
import {parseWorkDetails} from '@/lib/project-reporting/work-details';
import {isUuid} from '@/lib/operations/pilot-validation';
export const dynamic='force-dynamic';
export default async function Details({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const {id}=await params;const q=await searchParams;
 try{
  const month=q.ay,location=typeof q.sube==='string'?q.sube:null,offset=pageOffset(q.sayfa);
  if(!isUuid(id)||typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)||(location&&!isUuid(location)))throw Error('REPORT_INPUT');
  const {c,scope}=await projectContext();const result=await c.rpc('reporting_work_details',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:id,p_month:month,p_location:location??undefined,p_offset:offset});if(result.error)throw result.error;
  const r=parseWorkDetails(result.data,scope.tenantId,id,month,location,offset),href=(n:number)=>`?ay=${month}${location?'&sube='+location:''}&sayfa=${n}`;
  return <div className="space-y-4"><Link className="inline-flex min-h-11 items-center underline" href={`/projeler/${id}/rapor?ay=${month}`}>← Aylık rapora dön</Link><h1 className="text-2xl font-semibold">Çalışma kayıtları</h1><p className="text-sm text-slate-600">{month.slice(5)} / {month.slice(0,4)} · {r.total} kayıt{location?' · Seçilen şube':''}</p>{!r.total?<p className="rounded-xl border bg-white p-5">Bu seçimde onaylı çalışma kaydı yok.</p>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead><tr>{['Tarih','Personel','Şube','Vardiya','Süre'].map(h=><th className="whitespace-nowrap p-3" key={h}>{h}</th>)}</tr></thead><tbody>{r.rows.map(a=><tr className="border-t" key={JSON.stringify([a.source,a.sourceId])}><td className="whitespace-nowrap p-3">{a.day.split('-').reverse().join('.')}</td><td className="min-w-40 p-3">{a.personName}</td><td className="min-w-40 p-3">{a.locationName}</td><td className="p-3">{a.slot}</td><td className="whitespace-nowrap p-3">{workDuration(a.minutes)}</td></tr>)}</tbody></table></div>}<nav aria-label="Çalışma kaydı sayfaları" className="flex gap-4">{offset>0&&<Link className="min-h-11 py-3 underline" href={href(offset-50)}>Önceki</Link>}{offset+50<r.total&&<Link className="min-h-11 py-3 underline" href={href(offset+50)}>Sonraki</Link>}</nav></div>;
 }catch{return <section className="space-y-4"><h1 className="text-xl font-semibold">Çalışma kayıtları</h1><p role="alert">Kayıtlar yüklenemedi. Projeden dönemi yeniden seçin.</p><Link className="inline-flex min-h-11 items-center underline" href={isUuid(id)?`/projeler/${id}`:'/projeler'}>Projeye dön</Link></section>;}
}
