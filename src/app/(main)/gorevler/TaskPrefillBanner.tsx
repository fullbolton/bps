"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { parseTaskPrefillSearch, type TaskPrefill } from "@/lib/operations/task-prefill";
import { pilotTaskPrefillAction } from "../talepler/gunluk/actions";

export default function TaskPrefillBanner({ onPrepare, disabled }: {
  onPrepare: (prefill: TaskPrefill) => void; disabled: boolean;
}) {
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const queryKey = search.toString();
  useEffect(() => {
    generation.current++; setBusy(false); setError("");
    return () => { generation.current++; };
  }, [queryKey, disabled]);
  let query;
  try { query = parseTaskPrefillSearch(search); }
  catch { return <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-4">Talep bağlantısı geçersiz. Günlük plandan tekrar açın.</p>; }
  if (!query) return null;
  return <section className="mb-4 rounded-xl border bg-blue-50 p-4" aria-label="Talepten görev hazırlama">
    <p className="text-sm">Talebi yeniden kontrol ederek firma, şube ve gün bilgileriyle görev formunu hazırlayın.</p>
    <button disabled={busy || disabled} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40" onClick={async () => {
      if (busy) return;
      const requestGeneration = generation.current;
      setBusy(true); setError("");
      try {
        const result = await pilotTaskPrefillAction(query);
        if (requestGeneration !== generation.current) return;
        if (!result.ok) { setError(result.message); return; }
        onPrepare(result.data);
      } catch { if (requestGeneration === generation.current) setError("Talep bağlamı yüklenemedi. Yeniden deneyin."); }
      finally { if (requestGeneration === generation.current) setBusy(false); }
    }}>{busy ? "Talep kontrol ediliyor…" : "Bu talep için görev hazırla"}</button>
    {error && <p role="alert" className="mt-2 text-sm text-red-800">{error}</p>}
  </section>;
}
