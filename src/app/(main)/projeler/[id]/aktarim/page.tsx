import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import {projectContext} from '@/lib/project-reporting/server';
import {isUuid} from '@/lib/operations/pilot-validation';
import {pageOffset,parseProjectDetail} from '@/lib/project-reporting/view';
import {parseImportPreview} from '@/lib/project-reporting/import-view';
import ImportWizard from '../../ImportWizard';
export const dynamic='force-dynamic';
export default async function Imports({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 try{
  const {id}=await params,p=await searchParams;if(!isUuid(id))throw Error('REPORT_INPUT');
  const {c,scope,canWrite}=await projectContext();if(!canWrite)throw Error('REPORT_FORBIDDEN');
  const detail=await c.rpc('reporting_project_detail',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:id});if(detail.error)throw detail.error;
  const project=parseProjectDetail(detail.data,scope.tenantId,id,0,0);
  const batch=typeof p.islem==='string'?p.islem:null;if(batch&&!isUuid(batch))throw Error('REPORT_INPUT');
  let initial=null,month='';
  if(batch){const r=await c.rpc('reporting_import_read',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_batch:batch});if(r.error)throw r.error;const body=r.data as {projectId?:unknown;month?:unknown};if(body?.projectId!==id||typeof body.month!=='string')throw Error('REPORT_RESPONSE');initial=parseImportPreview(r.data);month=body.month;}
  const offset=pageOffset(p.sayfa);let history:null|{total:number;rows:{id:string;month:string;status:string;rowCount:number}[]}=null;
  if(!batch&&p.yeni!=='1'){
   const r=await c.rpc('reporting_import_list',{p_actor:scope.actorId,p_tenant:scope.tenantId,p_project:id,p_offset:offset});if(r.error)throw r.error;
   const v=r.data as {tenantId?:unknown;projectId?:unknown;offset?:unknown;total?:unknown;rows?:unknown};
   if(!v||v.tenantId!==scope.tenantId||v.projectId!==id||v.offset!==offset||!Number.isSafeInteger(v.total)||Number(v.total)<0||!Array.isArray(v.rows)||v.rows.length!==Math.min(50,Math.max(0,Number(v.total)-offset)))throw Error('REPORT_RESPONSE');
   for(const row of v.rows)if(!row||!isUuid(row.id)||typeof row.month!=='string'||!['pending','approved','cancelled'].includes(row.status)||!Number.isInteger(row.rowCount)||row.rowCount<1||row.rowCount>1000)throw Error('REPORT_RESPONSE');
   history={total:Number(v.total),rows:v.rows};
  }
  return <div className="space-y-5"><Link className="inline-flex min-h-11 items-center underline" href={'/projeler/'+id}>← Projeye dön</Link><PageHeader title="Çalışma raporu aktarımı" subtitle={project.name}/>
   {history?<section className="space-y-3"><Link className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 text-sm text-white" href={`?yeni=1`}>Yeni dosya aktar</Link>{!history.total&&<p className="rounded-xl border bg-white p-5">Henüz çalışma raporu aktarılmadı.</p>}{history.rows.map(r=><Link key={r.id} href={`?islem=${r.id}`} className="block rounded-xl border bg-white p-4"><span className="font-medium">{r.month.slice(5,7)} / {r.month.slice(0,4)}</span>{' '}<span className="ml-3 text-sm">{r.status==='pending'?'Onay bekliyor':r.status==='approved'?'Onaylandı':'İptal edildi'} · {r.rowCount} satır</span></Link>)}<nav className="flex gap-4" aria-label="Aktarım sayfaları">{offset>0&&<Link className="min-h-11 py-3 underline" href={`?sayfa=${offset-50}`}>Önceki</Link>}{offset+50<history.total&&<Link className="min-h-11 py-3 underline" href={`?sayfa=${offset+50}`}>Sonraki</Link>}</nav></section>:<ImportWizard key={scope.tenantId+scope.actorId+(batch??'new')} scope={scope} projectId={id} initial={initial} initialMonth={month} openMonths={project.periods.rows.filter(r=>r.status==='open').map(r=>r.month.slice(0,7))}/>}
  </div>;
 }catch{return <section className="space-y-3 rounded-xl border bg-white p-5"><h1 className="text-xl font-semibold">Çalışma raporu aktarımı</h1><p role="alert">Aktarım yüklenemedi. Çalışma alanınızı, bağlantıyı ve yetkinizi kontrol edin.</p><Link className="inline-flex min-h-11 items-center underline" href="/projeler">Projelere dön</Link></section>;}
}
