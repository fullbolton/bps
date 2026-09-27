'use client';
import {useCallback,useState} from 'react';
import {useScopedResource} from '@/components/ui/useScopedResource';
import type {CommandScope} from '@/lib/operations/pending-commands';
import {idpPeriodHistoryAction} from './actions';
const labels={created:'Dönem açıldı',update:'Dönem güncellendi',cancel:'Dönem iptal edildi'};
export default function IdpPeriodHistory({scope,periodId,revision}:{scope:CommandScope;periodId:string;revision:number}){
 const [open,setOpen]=useState(false),[cursors,setCursors]=useState<number[]>([]);
 const before=cursors.at(-1);
 const read=useCallback(async()=>{const r=await idpPeriodHistoryAction(scope,periodId,before);if(!r.ok)throw Error(r.message);return r.data;},[scope.actorId,scope.tenantId,periodId,before]);
 const result=useScopedResource(open?`${scope.actorId}:${scope.tenantId}:${periodId}:${revision}:${before??'first'}`:null,read);
 return <section className="mt-5 border-t pt-4"><button type="button" aria-expanded={open} className="min-h-11 font-medium text-blue-700" onClick={()=>setOpen(v=>!v)}>Dönem işlem geçmişi {open?'▴':'▾'}</button>{open&&(result.error?<div role="alert" className="text-sm">Geçmiş yüklenemedi. <button className="min-h-11 underline" onClick={()=>void result.reload()}>Yeniden dene</button></div>:result.loading?<p role="status">Geçmiş yükleniyor…</p>:result.data&&<><p className="mb-3 text-xs text-slate-500">Dönem açma, düzeltme ve iptal işlemleri. Günlük atama ve yoklama kayıtları ilgili günün talebindedir.</p>{!result.data.items.length?<p className="text-sm">Bu aralıkta kayıtlı dönem işlemi yok.</p>:<ol className="space-y-3">{result.data.items.map(r=><li key={r.id} className="rounded-xl border p-3 text-sm"><p className="font-medium">{labels[r.action]}</p><p className="text-xs text-slate-500">{new Date(r.at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'})} · {r.actorName}</p>{r.action!=='cancel'&&<p className="mt-2">{r.originalName} · {r.leaveStart} – {r.leaveEnd}</p>}{r.reason&&<p className="mt-2 break-words">Gerekçe: {r.reason}</p>}<p className="mt-2 text-slate-600">{r.added>0&&`${r.added} çalışma günü eklendi. `}{r.cancelled>0&&`${r.cancelled} gün iptal edildi.`}</p></li>)}</ol>}<div className="mt-3 flex gap-3">{!!cursors.length&&<button className="min-h-11 underline" onClick={()=>setCursors(v=>v.slice(0,-1))}>Daha yeni işlemler</button>}{result.data.hasMore&&<button className="min-h-11 underline" onClick={()=>setCursors(v=>[...v,result.data!.items.at(-1)!.revision])}>Daha eski işlemler</button>}</div></>)}</section>;
}
