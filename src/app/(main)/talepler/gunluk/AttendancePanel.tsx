"use client";
import type { AttendanceRecord,AttendanceStatus } from "@/lib/operations/pilot-types";
const labels:Record<AttendanceStatus,string>={unreported:"Henüz bildirilmedi",present:"Geldi",absent:"Gelmedi"};
export default function AttendancePanel({records,workers,future,disabled,onRecord}:{records:AttendanceRecord[];workers:{id:string;name:string}[];future:boolean;disabled:boolean;onRecord:(record:AttendanceRecord,status:AttendanceStatus)=>void}){
  if(!records.length)return null;
  const present=records.filter(a=>a.status==="present").length;
  const absent=records.filter(a=>a.status==="absent").length;
  const unknown=records.filter(a=>a.status==="unreported"&&!a.removed).length;
  return <section className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3" aria-label="Gerçekleşme bildirimleri">
    <h4 className="text-sm font-semibold">Gerçekleşme · {present} geldi · {absent} gelmedi · {unknown} aktif atama bildirilmedi</h4>
    <p className="mt-1 text-xs text-slate-600">{future?"Gerçekleşme iş günü geldiğinde bildirilebilir.":"Günlük bildirimdir; çalışma saati veya ücret onayı değildir. Kaldırılan atamaların bildirimleri korunur."}</p>
    <ul className="mt-3 space-y-3">{records.map(a=><li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>{workers.find(w=>w.id===a.workerId)?.name??"Personel"}{a.removed?" · atama kaldırıldı":""} · <strong>{labels[a.status]}</strong></span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={`${workers.find(w=>w.id===a.workerId)?.name??"Personel"} gerçekleşme`}>
        {(["present","absent","unreported"] as const).map(status=><button type="button" key={status} aria-pressed={a.status===status} disabled={disabled||future||a.status===status} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs disabled:opacity-40" onClick={()=>onRecord(a,status)}>{status==="unreported"?"Bildirimi geri al":labels[status]}</button>)}
      </div>
    </li>)}</ul>
  </section>;
}
