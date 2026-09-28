import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import {projectContext} from '@/lib/project-reporting/server';
import {pageOffset,parseProjectDetail,projectKinds} from '@/lib/project-reporting/view';
import {isUuid} from '@/lib/operations/pilot-validation';
import ProjectForm from '../ProjectForm';
import ProjectChangeForm from '../ProjectChangeForm';
export const dynamic='force-dynamic';
const display=(day:string)=>day.split('-').reverse().join('.');
export default async function Project({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 try{
  const {id}=await params;if(!isUuid(id))throw Error('REPORT_INPUT');
  const p=await searchParams,lo=pageOffset(p.subeler),po=pageOffset(p.donemler),{c,scope,canWrite,canClose}=await projectContext();
  const result=await c.rpc('reporting_project_detail',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:id,p_locations_offset:lo,p_periods_offset:po});if(result.error)throw result.error;
  const detail=parseProjectDetail(result.data,scope.tenantId,id,lo,po),query=typeof p.sube==='string'?p.sube.slice(0,100):'';
  let request=c.from('ops_locations').select('id,name',{count:'exact'}).eq('tenant_id',scope.tenantId).eq('company_id',detail.companyId).eq('active',true).order('name').order('id').limit(50);
  if(query)request=request.ilike('name','%'+query.replace(/[%_\\]/g,'\\$&')+'%');
  const choices=canWrite?await request:null;
  const href=(l:number,m:number)=>`/projeler/${id}?subeler=${l}&donemler=${m}`;
  return <div className="space-y-5"><Link href="/projeler" className="inline-flex min-h-11 items-center text-sm underline">← Projelere dön</Link><PageHeader title={detail.name} subtitle={`${detail.code} · ${projectKinds[detail.kind]}`}><Link className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm" href={'/firmalar/'+detail.companyId}>Müşteri kartı</Link></PageHeader>
   {canWrite&&<Link className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm text-white" href={`/projeler/${id}/aktarim`}>Çalışma raporu aktar</Link>}
   {canWrite&&<details className="rounded-xl border bg-white p-5"><summary className="min-h-11 cursor-pointer py-3 font-medium">Proje bilgilerini düzenle</summary><p className="mb-3 text-sm text-slate-600">Müşteri ve proje kodu korunur.</p><ProjectChangeForm key={'edit'+detail.revision} scope={scope} projectId={id} revision={detail.revision} change={{action:'edit_project',name:detail.name,kind:detail.kind}}/></details>}
   <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Rapor dönemleri</h2><p className="mt-1 text-sm text-slate-600">Dönem açmak rapor verisi eklemez.</p>
    {!detail.periods.total&&<p className="my-4 text-sm">Henüz rapor dönemi açılmadı.</p>}
    <ul className="my-4 divide-y">{detail.periods.rows.map(r=><li key={r.month} className="space-y-2 py-3"><div className="flex flex-wrap justify-between gap-2"><span>{r.month.slice(5,7)} / {r.month.slice(0,4)}</span><span className="text-sm">{r.status==='open'?'Açık dönem':'Kapalı dönem'}</span></div><Link className="inline-flex min-h-11 items-center text-sm underline" href={`/projeler/${id}/rapor?ay=${r.month.slice(0,7)}`}>Aylık raporu gör</Link>{r.lastReason&&<p className="text-sm text-slate-600">Son işlem gerekçesi: {r.lastReason}</p>}{canClose&&<details><summary className="min-h-11 cursor-pointer py-3 text-sm underline">{r.status==='open'?'Dönemi kapat':'Dönemi yeniden aç'}</summary><ProjectChangeForm key={r.month+detail.revision} scope={scope} projectId={id} revision={detail.revision} change={{action:r.status==='open'?'close_period':'reopen_period',month:r.month.slice(0,7)}}/></details>}</li>)}</ul>
    <nav aria-label="Dönem sayfaları" className="flex gap-4">{po>0&&<Link className="min-h-11 py-3 underline" href={href(lo,po-50)}>Önceki</Link>}{po+50<detail.periods.total&&<Link className="min-h-11 py-3 underline" href={href(lo,po+50)}>Sonraki</Link>}</nav>
    {canWrite&&<details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Rapor dönemi aç</summary><ProjectForm key={'period'+scope.tenantId+id} scope={scope} action="open_period" projectId={id} revision={detail.revision}/></details>}
   </section>
   <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Hizmet verilen şubeler</h2>
    {!detail.locations.total&&<p className="my-4 text-sm">Bu projeye henüz şube bağlanmadı.</p>}
    <ul className="my-4 divide-y">{detail.locations.rows.map(r=><li key={r.locationId+r.validFrom} className="py-3"><p className="break-words font-medium">{r.name}</p><p className="mt-1 text-sm text-slate-600">{display(r.validFrom)} — {r.validUntil?display(r.validUntil):'Bitiş belirtilmedi'}</p>{canWrite&&<details><summary className="min-h-11 cursor-pointer py-3 text-sm underline">Tarihleri düzenle</summary><ProjectChangeForm key={r.locationId+r.validFrom+detail.revision} scope={scope} projectId={id} revision={detail.revision} change={{action:'edit_location',locationId:r.locationId,from:r.validFrom,until:r.validUntil}}/></details>}</li>)}</ul>
    <nav aria-label="Şube sayfaları" className="flex gap-4">{lo>0&&<Link className="min-h-11 py-3 underline" href={href(lo-50,po)}>Önceki</Link>}{lo+50<detail.locations.total&&<Link className="min-h-11 py-3 underline" href={href(lo+50,po)}>Sonraki</Link>}</nav>
    {canWrite&&<details open={!!query}><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Şube bağla</summary><form className="mb-4 flex flex-wrap gap-2"><label className="flex-1 text-sm">Şube ara<input name="sube" defaultValue={query} className="mt-1 block min-h-11 w-full rounded-lg border px-3"/></label><button className="min-h-11 self-end rounded-lg border px-4">Ara</button></form>
     {choices?.error||choices?.count===null?<p role="alert">Şubeler yüklenemedi. Sayfayı yenileyin.</p>:<>{(choices?.count??0)>50&&<p className="mb-3 text-sm">İlk 50 şube gösteriliyor. Aramayla listeyi daraltın.</p>}{!choices?.data?.length&&<p className="mb-3 text-sm">Aramaya uygun aktif şube bulunamadı. Şubeleri müşteri kartından yönetebilirsiniz.</p>}<ProjectForm key={'location'+scope.tenantId+id+query} scope={scope} action="link_location" projectId={id} revision={detail.revision} choices={choices?.data??[]}/></>}
    </details>}
   </section>
  </div>;
 }catch{return <section className="rounded-xl border bg-white p-6"><h1 className="text-2xl font-semibold">Proje detayı</h1><p role="alert" className="my-4">Proje yüklenemedi. Bağlantıyı ve çalışma alanınızı kontrol edin.</p><Link href="/projeler" className="inline-flex min-h-11 items-center underline">Projelere dön</Link></section>;}
}
