import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import {projectContext} from '@/lib/project-reporting/server';
import {pageOffset,parseProjectList,projectKinds} from '@/lib/project-reporting/view';
import ProjectForm from './ProjectForm';
export const dynamic='force-dynamic';
export default async function Projects({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 try{
  const params=await searchParams,offset=pageOffset(params.sayfa),{c,scope,canWrite}=await projectContext();
  const result=await c.rpc('reporting_project_list',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_offset:offset});if(result.error)throw result.error;
  const page=parseProjectList(result.data,scope.tenantId,offset);
  const query=typeof params.firma==='string'?params.firma.slice(0,100):'';
  let companies=c.from('companies').select('id,name',{count:'exact'}).eq('tenant_id',scope.tenantId).order('name').order('id').limit(50);
  if(query)companies=companies.ilike('name','%'+query.replace(/[%_\\]/g,'\\$&')+'%');
  const choices=canWrite?await companies:null;
  return <div className="space-y-5"><PageHeader title="Projeler" subtitle="Müşterilerinize verdiğiniz hizmetleri ve aylık rapor dönemlerini burada düzenleyin."/>
   <section aria-label="Proje listesi" className="space-y-3">
    {!page.total?<p className="rounded-xl border bg-white p-6">Henüz proje yok. İlk projenizi müşteri seçerek oluşturabilirsiniz.</p>:page.rows.length===0?<p>Bu sayfada proje yok. <Link href="/projeler" className="underline">İlk sayfaya dön</Link></p>:page.rows.map(p=><Link href={'/projeler/'+p.id} key={p.id} className="block rounded-xl border bg-white p-4 hover:border-blue-400 focus-visible:ring-2"><div className="flex flex-wrap justify-between gap-2"><h2 className="break-words font-semibold">{p.name}</h2><span className="text-sm text-slate-600">{projectKinds[p.kind]}</span></div><p className="mt-1 text-sm text-slate-600">{p.companyName} · {p.code}</p><p className="mt-3 text-sm">{p.latestPeriod?'Son açılan dönem: '+p.latestPeriod.slice(0,7):'Henüz rapor dönemi açılmadı'}</p></Link>)}
    <nav aria-label="Proje sayfaları" className="flex gap-4">{offset>0&&<Link className="inline-flex min-h-11 items-center underline" href={'/projeler?sayfa='+Math.max(0,offset-50)}>Önceki</Link>}{offset+50<page.total&&<Link className="inline-flex min-h-11 items-center underline" href={'/projeler?sayfa='+(offset+50)}>Sonraki</Link>}</nav>
   </section>
   {canWrite&&<details className="rounded-xl border bg-white p-5" open={page.total===0}><summary className="min-h-11 cursor-pointer font-semibold">Yeni proje</summary><form className="my-4 flex flex-wrap gap-2"><label className="flex-1 text-sm">Müşteri ara<input name="firma" defaultValue={query} className="mt-1 block min-h-11 w-full rounded-lg border px-3"/></label><button className="min-h-11 self-end rounded-lg border px-4">Ara</button></form>
    {choices?.error||choices?.count===null?<p role="alert">Müşteri listesi yüklenemedi. Sayfayı yenileyin.</p>:<>{(choices?.count??0)>50&&<p className="mb-3 text-sm">İlk 50 müşteri gösteriliyor. Aramayla listeyi daraltın.</p>}<ProjectForm key={scope.tenantId+query} scope={scope} action="create" choices={choices?.data??[]}/></>}
   </details>}
  </div>;
 }catch{return <section className="space-y-3 rounded-xl border bg-white p-6"><h1 className="text-2xl font-semibold">Projeler</h1><p role="alert">Projeler yüklenemedi. Çalışma alanınızı kontrol edip tekrar deneyin.</p><Link className="inline-flex min-h-11 items-center underline" href="/projeler">Yeniden dene</Link></section>;}
}
