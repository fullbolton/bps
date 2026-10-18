"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {cancelDocumentUpload, recoverDocumentUpload} from "@/app/(main)/evraklar/upload-actions";
import {createClient} from "@/lib/supabase/client";
import {useScopedResource} from "@/components/ui/useScopedResource";
import {listPendingDocumentUploads} from "@/lib/services/document-pending-uploads";

export default function PendingDocumentUploads({tenantId, onRecovered}: {tenantId: string; onRecovered?: () => void}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const followLink = () => {
      if (window.location.hash === "#yarim-kalan-yuklemeler") setOpen(true);
    };
    followLink();
    window.addEventListener("hashchange", followLink);
    return () => window.removeEventListener("hashchange", followLink);
  }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const flight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {alive.current = true; return () => {alive.current = false;};}, []);
  const [offset, setOffset] = useState(0);
  const reader = useCallback(() => listPendingDocumentUploads(createClient(), tenantId, offset), [tenantId, offset]);
  const resource = useScopedResource(open ? `${tenantId}:${offset}` : null, reader);
  async function recover(id: string, cancel = false) {
    if (flight.current) return;
    flight.current = true; setBusy(id); setMessage("");
    try {
      const result = await (cancel ? cancelDocumentUpload : recoverDocumentUpload)(tenantId, id);
      if (!alive.current) return;
      setMessage(result.message);
      if (result.ok) {
        setConfirmCancel(null);
        onRecovered?.();
        // Removing the only row on a later page should not strand the user on an empty page.
        if (offset > 0 && resource.data?.rows.length === 1) setOffset(value => Math.max(0, value - 50));
        else await resource.reload();
      }
    } catch {if (alive.current) setMessage("Sonuç doğrulanamadı. Listeyi yenileyerek kontrol edin.");}
    finally {flight.current = false; if (alive.current) setBusy(null);}
  }
  return <section id="yarim-kalan-yuklemeler" className="mb-4 scroll-mt-4 rounded-xl border border-slate-200 bg-white p-4">
    <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)} className="min-h-11 text-sm font-medium text-slate-700">Yarım kalan yüklemeler {open ? "▴" : "▾"}</button>
    {open && <div className="space-y-3">
      <p className="text-sm text-slate-600">Bu işlemlerin belge kaydı henüz tamamlanmamış. Aynı dosyayı yeniden yüklemeden önce buradan kontrol edin. Yönetici şirketin tüm bekleyen yüklemelerini, diğer kullanıcılar kendi yüklemelerini görür.</p>
      <button type="button" disabled={resource.loading || !!busy} onClick={() => void resource.reload()} className="min-h-11 px-3 text-sm underline disabled:opacity-50">Listeyi yenile</button>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
      {resource.loading && <p role="status" className="text-sm">Yüklemeler kontrol ediliyor…</p>}
      {resource.error && <p role="alert" className="text-sm text-red-700">Bekleyen yüklemeler alınamadı. Listeyi yenileyerek tekrar deneyin.</p>}
      {resource.data?.rows.length === 0 && <p className="text-sm text-slate-600">Bu sayfada bekleyen yükleme yok.</p>}
      {resource.data?.rows.map(row => <article key={row.document_id} className="space-y-1 border-t border-slate-100 py-3">
        <h3 className="text-sm font-medium">{row.document_name}</h3>
        <p className="text-sm text-slate-600">{row.company_name ?? "Firma kaydı kaldırılmış"}</p>
        <p className="text-sm text-amber-800">{row.file_present ? "Dosya depoya ulaşmış; belge kaydı tamamlanmamış." : "Dosya depoda henüz görünmüyor. Yükleme kesilmiş veya sürüyor olabilir."}</p>
        <p className="text-xs text-slate-500">{new Date(row.created_at).toLocaleString("tr-TR", {timeZone: "Europe/Istanbul"})}</p>
        {row.file_present && row.can_resume && <button type="button" disabled={!!busy || resource.loading} onClick={() => void recover(row.document_id)} className="min-h-11 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white disabled:opacity-50">{busy === row.document_id ? "Kontrol ediliyor…" : "Yüklemeyi tamamla"}</button>}
        {row.can_resume && (confirmCancel === row.document_id ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm">Bu yükleme iptal edilsin mi? Bu işlemden belge oluşturulamayacak. Varsa dosya, yöneticinin temizlik listesine alınacak.</p>
          <button type="button" disabled={!!busy} onClick={() => void recover(row.document_id, true)} className="min-h-11 px-3 text-sm font-medium text-red-700 disabled:opacity-50">İptali onayla</button>
          <button type="button" disabled={!!busy} onClick={() => setConfirmCancel(null)} className="min-h-11 px-3 text-sm">Vazgeç</button>
        </div> : <button type="button" disabled={!!busy || resource.loading} onClick={() => setConfirmCancel(row.document_id)} className="min-h-11 px-3 text-sm text-slate-600 disabled:opacity-50">Yüklemeyi iptal et</button>)}
        {!row.can_resume && <p className="text-xs text-slate-500">Bu işlemi dosyayı yükleyen kullanıcı tamamlayabilir.</p>}
        <p className="break-all text-xs text-slate-500">İşlem: {row.document_id}</p>
      </article>)}
      <p className="text-xs text-slate-500">Tamamla dediğinizde dosya kontrol edilir ve mevcut yükleme belgeye dönüştürülür. İptal, yüklemeyi sonlandırır; dosyanın depodan temizlenmesi ayrı takip edilir.</p>
      <nav aria-label="Bekleyen yükleme sayfaları" className="flex gap-3">
        <button type="button" disabled={offset === 0 || resource.loading || !!busy} onClick={() => setOffset(v => Math.max(0,v-50))} className="min-h-11 px-3 text-sm disabled:opacity-40">Önceki</button>
        <button type="button" disabled={!resource.data?.hasMore || resource.loading || !!busy} onClick={() => setOffset(v => v+50)} className="min-h-11 px-3 text-sm disabled:opacity-40">Sonraki</button>
      </nav>
    </div>}
  </section>;
}
