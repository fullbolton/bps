"use client";
import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProfileRow } from "@/types/database.types";
import { listTaskAssignmentHistory } from "@/lib/services/tasks";

type History = Awaited<ReturnType<typeof listTaskAssignmentHistory>>;
const labels = {baseline:"Başlangıç kaydı",created:"Görev oluşturuldu",assigned:"Atandı",reassigned:"Devredildi",unassigned:"Atama kaldırıldı"};

export default function TaskAssignmentHistory({client,taskId,profiles}:{client:SupabaseClient<Database>;taskId:string;profiles:ProfileRow[]}) {
  const [result,setResult]=useState<History|null>(null);
  const [error,setError]=useState("");
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;setResult(null);setError("");
    listTaskAssignmentHistory(client,taskId).then(value=>{if(active)setResult(value);})
      .catch(()=>{if(active)setError("Atama geçmişi yüklenemedi.");});
    return()=>{active=false;};
  },[client,taskId,attempt]);
  const name=(id:string|null)=>id?(profiles.find(p=>p.id===id)?.display_name??"Kullanıcı (listede yok)"):"Atanmadı";
  return <section className="rounded-lg border p-3" aria-label="Atama geçmişi">
    <h4 className="text-sm font-semibold">Atama geçmişi</h4>
    {error?<div role="alert" className="mt-2 text-sm text-red-700">{error} <button className="underline" onClick={()=>setAttempt(n=>n+1)}>Yeniden dene</button></div>:!result?<p role="status" className="mt-2 text-sm">Geçmiş yükleniyor…</p>:<>
      {!result.rows.length&&<p className="mt-2 text-sm">Geçmiş kaydı bulunamadı veya erişilemiyor.</p>}
      {result.hasMore&&<p className="mt-2 text-xs text-slate-600">Son 20 atama kaydı gösteriliyor.</p>}
      <ol className="mt-2 space-y-3">{result.rows.map(row=><li key={row.revision} className="text-sm">
        <p className="font-medium">{labels[row.kind]}</p>
        <p>{row.kind==="baseline"||row.kind==="created"?name(row.next_user_id):`${name(row.previous_user_id)} → ${name(row.next_user_id)}`}</p>
        <p className="text-xs text-slate-600">{new Date(row.recorded_at).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"})} (İstanbul) · {row.actor_id?name(row.actor_id):"Sistem / başlangıç"}</p>
        {row.kind==="baseline"&&<p className="text-xs text-slate-600">Geçmiş takibi başladığındaki atama; önceki değişiklikleri içermez.</p>}
      </li>)}</ol>
    </>}
  </section>;
}
