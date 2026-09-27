"use client";
import {useCallback,useState} from 'react';
import {useScopedResource} from '@/components/ui/useScopedResource';
import {workStatusLabels,type WorkStatus} from '@/lib/operations/work-approval';
import type {CommandScope} from '@/lib/operations/pending-commands';
import {workListAction} from './actions';
export type WorkTarget={assignmentId:string;workerName:string;workDate:string;closed?:boolean};
export default function WorkApprovalQueue({scope,companyId,workDate,refreshToken,disabled,onOpen}:{scope:CommandScope;companyId:string;workDate:string;refreshToken:number;disabled:boolean;onOpen:(target:WorkTarget)=>void}){
 const [status,setStatus]=useState<WorkStatus|''>('submitted'),[limit,setLimit]=useState(25);
 const reader=useCallback(()=>workListAction(scope,companyId,workDate),[scope,companyId,workDate]);
 const resource=useScopedResource(`${scope.actorId}:${scope.tenantId}:${companyId}:${workDate}:${refreshToken}`,reader);
 const rows=resource.data,waiting=rows?.filter(row=>row.status==='submitted').length;
 const visible=rows?.filter(row=>!status||row.status===status);
 return <details className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
  <summary className="min-h-11 cursor-pointer py-2 font-semibold">Çalışma onayları{waiting!==undefined?` · ${waiting} onay bekliyor`:''}</summary>
  {resource.loading?<p role="status">Çalışma kayıtları yükleniyor…</p>:resource.error?<div role="alert"><p>Çalışma listesi doğrulanamadı. Boş liste olarak gösterilmiyor.</p><button type="button" className="min-h-11 text-blue-700 underline" disabled={disabled} onClick={()=>void resource.reload()}>Çalışma listesini yenile</button></div>:<>
   <p className="my-2 text-sm text-slate-600">Seçili firma ve günün {rows?.length} çalışma kaydı. Yeni kayıt için personel satırındaki “Çalışma kaydı ve onay” düğmesini kullanın.</p>
   <label className="block text-sm">Çalışma durumu<select className="ml-2 min-h-11 rounded-lg border bg-white p-2" value={status} onChange={e=>{setStatus(e.target.value as WorkStatus|'');setLimit(25);}}><option value="">Tüm çalışma kayıtları</option>{Object.entries(workStatusLabels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
   {!visible?.length?<p className="my-3 text-sm">Bu durumda çalışma kaydı yok.</p>:<ul className="mt-3 divide-y">{visible.slice(0,limit).map(row=><li key={row.assignmentId} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="font-medium">{row.workerName} · {row.locationName}</p><p className="text-sm text-slate-600">{workStatusLabels[row.status]} · {Math.floor(row.netMinutes/60)} sa {row.netMinutes%60} dk{row.closed?' · Geçmiş atama':''}</p></div><button type="button" className="min-h-11 rounded-lg border px-3 py-2 text-sm" disabled={disabled} onClick={()=>onOpen({assignmentId:row.assignmentId,workerName:row.workerName,workDate,closed:row.closed})}>Kaydı incele</button></li>)}</ul>}
   {visible&&visible.length>limit&&<button type="button" className="min-h-11 text-sm text-blue-700 underline" onClick={()=>setLimit(n=>n+25)}>25 kayıt daha göster ({limit} / {visible.length})</button>}
  </>}
 </details>;
}
