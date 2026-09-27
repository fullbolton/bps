"use client";
import {useCallback,useState} from 'react';
import {Button} from '@/components/ui/button';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {availabilityLabels} from '@/lib/talent/availability';
import type {TalentScope} from '@/lib/talent/people';
import {talentMergedAvailabilityAction} from './actions';

export default function MergedAvailability({scope,personId}:{scope:TalentScope;personId:string}){
 const [open,setOpen]=useState(false);
 return <details className="rounded-xl border p-4" onToggle={e=>setOpen(e.currentTarget.open)}>
  <summary className="min-h-11 cursor-pointer font-semibold">Birleşen kartların eski müsaitlik kayıtları</summary>
  <p className="mt-2 text-sm text-slate-600">Bu kayıtlar geçmişi görmek içindir. Güncel müsaitlik için ana karttaki teyit geçerlidir.</p>
  {open&&<History scope={scope} personId={personId}/>}
 </details>;
}
function History({scope,personId}:{scope:TalentScope;personId:string}){
 const [offset,setOffset]=useState(0);
 const read=useCallback(async()=>{const r=await talentMergedAvailabilityAction(scope,personId,offset);if(!r.ok)throw Error(r.message);return r.data;},[scope,personId,offset]);
 const data=useScopedResource(`${scope.actorId}:${scope.tenantId}:${personId}:${offset}`,read);
 return <div className="mt-3 space-y-3">
  {data.loading?<p role="status">Eski teyitler okunuyor…</p>:data.error?<div role="alert"><p>Eski teyitler okunamadı.</p><Button variant="outline" onClick={()=>void data.reload()}>Yeniden dene</Button></div>:!data.data?.length?<p className="text-sm text-slate-500">Bu sayfada eski teyit yok.</p>:<ul className="divide-y">{data.data.slice(0,20).map(row=><li key={row.id} className="space-y-1 py-3 text-sm">
   <p className="break-words font-medium">{row.source_name} · {availabilityLabels[row.state]}</p>
   <p>{row.starts_on.split('-').reverse().join('.')} – {row.ends_on.split('-').reverse().join('.')}</p>
   <p className="text-xs text-slate-500">Kaydedildi: {new Intl.DateTimeFormat('tr-TR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Istanbul'}).format(new Date(row.recorded_at))}</p>
  </li>)}</ul>}
  <div className="flex justify-between gap-2"><Button variant="outline" disabled={data.loading||offset===0} onClick={()=>setOffset(n=>n-20)}>Önceki</Button><Button variant="outline" disabled={data.loading||!!data.error||(data.data?.length??0)<=20||offset>=100000} onClick={()=>setOffset(n=>n+20)}>Sonraki</Button></div>
 </div>;
}
