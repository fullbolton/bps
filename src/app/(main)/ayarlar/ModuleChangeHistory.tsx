"use client";
import {useCallback,useMemo,useState} from 'react';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {createClient} from '@/lib/supabase/client';
import {loadModuleHistory} from '@/lib/services/workspace-modules';
import type {WorkspaceModuleContext} from '@/lib/modules/context';
import {MODULE_CATALOG} from '@/lib/modules/catalog';
export default function ModuleChangeHistory({context}:{context:WorkspaceModuleContext}) {
 const [open,setOpen]=useState(false);
 const client=useMemo(()=>createClient(),[]);
 const read=useCallback(()=>loadModuleHistory(client,context),[client,context]);
 const resource=useScopedResource(open?JSON.stringify([context.actorId,context.tenantId,context.membershipVersion,context.selectionVersion,context.configRevision]):null,read);
 return <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Modül değişiklik geçmişi">
  <button type="button" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className="flex min-h-11 w-full items-center justify-between text-left font-semibold text-slate-900">Değişiklik geçmişi <span aria-hidden="true">{open?'−':'+'}</span></button>
  {open&&<div className="space-y-3 pt-3">
   <p className="text-sm text-slate-600">Bu şirketin son 20 modül kaydı. İsimler güncel kullanıcı adlarıdır; ilk kurulum sistem kaydıdır.</p>
   <button type="button" disabled={resource.loading} onClick={()=>void resource.reload()} className="min-h-11 rounded-lg border px-3 text-sm disabled:opacity-50">Geçmişi yenile</button>
   {resource.loading&&<p role="status">Değişiklikler yükleniyor…</p>}
   {resource.error&&<p role="alert" className="text-sm text-red-700">Geçmiş doğrulanamadı. Tekrar deneyin; şirket ayarları değiştiyse üstteki Durumu yenile düğmesini kullanın.</p>}
   {resource.data&&<ol className="divide-y divide-slate-100">{resource.data.map(entry=><li key={entry.revision} className="py-3">
    <p className="text-sm font-medium text-slate-900">{entry.kind==='bootstrap'?'Çalışma alanı oluşturuldu':entry.actorName}</p>
    <time dateTime={entry.createdAt} className="text-xs text-slate-500">{new Intl.DateTimeFormat('tr-TR',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(entry.createdAt))}</time>
    {entry.kind==='settings'&&<ul className="mt-2 space-y-1 text-sm text-slate-700">{entry.changes.map(change=><li key={change.key}>{MODULE_CATALOG.find(m=>m.key===change.key)!.name}: {change.enabled?'Açıldı':'Kapatıldı'}</li>)}</ul>}
   </li>)}</ol>}
  </div>}
 </section>;
}
