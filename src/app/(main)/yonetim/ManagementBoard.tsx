'use client';
import Link from 'next/link';
import {useCallback,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useWorkspace} from '@/context/WorkspaceContext';
import {useNavigationGuard} from '@/context/NavigationGuardContext';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {Button} from '@/components/ui/button';
import {PageHeader} from '@/components/ui';
import {matchesWorkspace,type WorkspaceScope} from '@/lib/workspace-context';
import {managementQuery,MANAGEMENT_PAGE_SIZE,type ManagementQuery} from '@/lib/management-board';
import {taskLinkHref} from '@/lib/task-link';
import {managementBoardAction} from './actions';
const field='w-full min-w-0 min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm';
export default function ManagementBoard({scope}:{scope:WorkspaceScope}){
 const {user,role,loading}=useAuth(),{workspace}=useWorkspace(),guard=useNavigationGuard();
 const allowed=!loading&&role==='yonetici'&&user?.id===scope.actorId&&user.app_metadata.active_tenant===scope.tenantId&&matchesWorkspace(workspace,scope);
 const [query,setQuery]=useState<ManagementQuery>(managementQuery);
 const reader=useCallback(async()=>{const r=await managementBoardAction(scope,query);if(!r.ok)throw Error(r.message);return r.data;},[scope,query]);
 const resource=useScopedResource(allowed?`${scope.actorId}:${scope.tenantId}`:null,reader),data=resource.data;
 if(loading)return <p role="status">Oturum doğrulanıyor…</p>;
 if(!allowed)return <p role="alert">Şirket ve yönetici yetkisi doğrulanıyor. Devam etmiyorsa sayfayı yenileyin.</p>;
 return <>
  <PageHeader title="Şirket yönetimi" subtitle={`${workspace?.name} · Ekip sorumlulukları ve yönetim işlemleri`}/>
  <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[
   ['Ekip ve erişim','Üyeleri ve davetleri yönetin.','/kurulum'],
   ['Şube ve personel kayıtları','Hizmet noktalarını ve operasyon personelini düzenleyin.','/talepler/dizin'],
   ['Sözleşmeler','Müşteri anlaşmalarını ve sürelerini takip edin.','/sozlesmeler'],
   ['Evraklar','Firma belgelerini ve dosyaları klasörlerinde bulun.','/evraklar'],
   ['Finans ve Luca','Firma alacaklarını inceleyin ve Luca mizanını aktarın.','/finansal-ozet']
  ].map(([title,description,href])=><Link key={href} href={href} onClick={guard.handle} className="rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-500"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-600">{description}</p></Link>)}</div>
  <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="Ekip iş dağılımı">
   <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Kimde ne iş var?</h2><p className="mt-1 text-sm text-slate-600">Açık ve devam eden işler. Görevi açarak üstlenin, devredin veya tamamlayın.</p></div><Link href="/gorevler" onClick={guard.handle} className="inline-flex min-h-11 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">Tüm görevleri aç →</Link></div>
   <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-3">
    <label className="grid min-w-0 flex-[1_1_180px] gap-1 text-sm">Sorumlu<select className={field} value={query.owner} onChange={e=>setQuery({...query,owner:e.target.value,offset:0})}><option value="all">Tüm ekip</option><option value="unassigned">Henüz üstlenilmemiş</option>{query.owner!=='all'&&query.owner!=='unassigned'&&!data?.members.some(m=>m.id===query.owner)&&<option value={query.owner}>Seçili üye</option>}{data?.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    <label className="grid min-w-0 flex-[1_1_180px] gap-1 text-sm">Son tarih<select className={field} value={query.period} onChange={e=>setQuery({...query,period:e.target.value as ManagementQuery['period'],offset:0})}><option value="all">Tüm açık işler</option><option value="today">Bugün</option><option value="overdue">Tarihi geçmiş</option><option value="undated">Tarih verilmemiş</option></select></label>
    {(query.owner!=='all'||query.period!=='all')&&<Button variant="outline" onClick={()=>setQuery({...managementQuery})}>Filtreleri temizle</Button>}
    <Button variant="outline" disabled={resource.loading} onClick={()=>void resource.reload()}>Yenile</Button>
   </div>
   {resource.loading?<p role="status">İşler okunuyor…</p>:resource.error?<div role="alert"><p>İşler yüklenemedi. Yeniden deneyin.</p><Button className="mt-3" onClick={()=>void resource.reload()}>Yeniden dene</Button></div>:data&&<>
    <p className="mb-3 text-sm text-slate-600">{data.total} açık iş · Son güncelleme {new Date(data.readAt).toLocaleTimeString('tr-TR',{timeZone:'Europe/Istanbul',hour:'2-digit',minute:'2-digit'})}</p>
    {!data.rows.length?<p className="rounded-xl bg-slate-50 p-5">{query.offset?'Bu sayfada iş kalmadı. Önceki sayfaya dönün.':'Bu filtrelerde açık iş yok.'}</p>:<ul className="divide-y divide-slate-100">{data.rows.map(t=>{
     const owner=t.assigned_to_user_id?(data.members.find(m=>m.id===t.assigned_to_user_id)?.name??'Üyeliği doğrulanamayan sorumlu'):'Üstlenilmemiş';
     return <li key={t.id}><Link onClick={guard.handle} href={taskLinkHref(t.id)} className="flex min-h-20 flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center rounded-xl px-2 py-4 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-500"><div className="min-w-0 flex-1 break-words"><p className="font-medium">{t.title}</p><p className="mt-1 text-sm text-slate-600">{owner} · {t.company_id?'Firmaya bağlı':'Firma dışı görev'}</p>{!t.assigned_to_user_id&&t.assigned_to&&<p className="text-xs text-amber-700">Eski sorumlu notu: {t.assigned_to}; kullanıcı ataması yapılmamış.</p>}</div><div className="shrink-0 text-sm"><p>{t.status==='devam_ediyor'?'Devam ediyor':t.status==='gecikti'?'Gecikti':'Açık'}</p><p className={t.due_date&&t.due_date<data.today?'text-amber-700':'text-slate-500'}>{t.due_date?`Son tarih: ${t.due_date.split('-').reverse().join('.')}`:'Tarih verilmemiş'}</p></div></Link></li>;
    })}</ul>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-500">{data.rows.length?`${query.offset+1}–${query.offset+data.rows.length} / ${data.total}`:'0 gösteriliyor'}</p><div className="flex gap-2"><Button variant="outline" disabled={!query.offset} onClick={()=>setQuery({...query,offset:query.offset-MANAGEMENT_PAGE_SIZE})}>Önceki</Button><Button variant="outline" disabled={query.offset+MANAGEMENT_PAGE_SIZE>=data.total} onClick={()=>setQuery({...query,offset:query.offset+MANAGEMENT_PAGE_SIZE})}>Sonraki</Button></div></div>
   </>}
  </section>
 </>;
}
