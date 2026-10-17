"use client";

import {useEffect, useRef, useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {retryDocumentCleanup} from "@/app/(main)/evraklar/cleanup-actions";

type Job = {document_id: string; document_name: string | null; company_name: string | null; created_at: string};
/** Parent keys this panel by authenticated tenant/user/role scope. */
export default function DocumentCleanupPanel({tenantId, refreshVersion = 0}: {tenantId: string; refreshVersion?: number}) {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [version, setVersion] = useState(0);
  const [rows, setRows] = useState<Job[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const flight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError(""); setRows([]);
    void (async () => {
      try {
        const result = await createClient().rpc("document_pending_cleanup_v1", {p_tenant: tenantId, p_offset: offset});
        if (result.error || !Array.isArray(result.data)) throw Error("load");
        if (active) {setRows(result.data.slice(0,50)); setMore(result.data.length > 50);}
      } catch {
        if (active) setError("Bekleyen işlemler alınamadı. Yenileyerek tekrar deneyin.");
      } finally {if (active) setLoading(false);}
    })();
    return () => {active = false;};
  }, [open, offset, tenantId, version, refreshVersion]);
  async function retry(id: string) {
    if (flight.current) return;
    flight.current = true; setBusy(id); setMessage("");
    try {
      const result = await retryDocumentCleanup(tenantId, id);
      if (!alive.current) return;
      setMessage(result.message);
      if (result.ok) {setOffset(0); setVersion(v => v + 1);}
    } catch {if (alive.current) setMessage("Sonuç doğrulanamadı. Listeyi yenileyin.");}
    finally {flight.current = false; if (alive.current) setBusy(null);}
  }
  return <section className="rounded-xl border border-slate-200 bg-white p-4">
    <button type="button" className="min-h-11 text-sm font-medium text-slate-700" aria-expanded={open} onClick={() => setOpen(v => !v)}>Dosya temizliği {open ? "▴" : "▾"}</button>
    {open && <div className="space-y-3">
      <p className="text-sm text-slate-600">Listeden silinen ancak depodan kaldırıldığı henüz doğrulanamayan dosyalar. Tekrar denemek belge kaydını geri getirmez.</p>
      <button type="button" disabled={loading || !!busy} className="min-h-11 px-3 text-sm underline disabled:opacity-50" onClick={() => setVersion(v => v + 1)}>Listeyi yenile</button>
      {loading && <p role="status">İşlemler yükleniyor…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      {!loading && !error && rows.length === 0 && <p className="text-sm text-slate-600">Bu sayfada bekleyen dosya temizliği yok.</p>}
      {!loading && !error && rows.map(row => <div key={row.document_id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 py-3">
        <div><p className="text-sm font-medium">{row.document_name ?? "Silinen belge"}</p><p className="text-sm text-slate-600">{row.company_name ?? "Firma kaydı kaldırılmış"}</p><p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("tr-TR", {timeZone: "Europe/Istanbul"})}</p><p className="break-all text-xs text-slate-500">İşlem: {row.document_id}</p></div>
        <button type="button" disabled={!!busy} onClick={() => void retry(row.document_id)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">{busy === row.document_id ? "Kontrol ediliyor…" : "Temizliği tekrar dene"}</button>
      </div>)}
      <div className="flex gap-3"><button type="button" disabled={offset === 0 || loading || !!busy} className="min-h-11 px-3 text-sm disabled:opacity-40" onClick={() => setOffset(v => Math.max(0,v-50))}>Önceki</button><button type="button" disabled={!more || !!error || loading || !!busy} className="min-h-11 px-3 text-sm disabled:opacity-40" onClick={() => setOffset(v => v+50)}>Sonraki</button></div>
    </div>}
  </section>;
}
