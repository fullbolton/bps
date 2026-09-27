"use client";
import { useState, useEffect, useId, useRef } from "react";
import { ModalShell } from "@/components/ui";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { isDocumentValidityDate } from "@/lib/document-validity";

interface UpdateValidityModalProps {
  open: boolean;
  onClose: () => void;
  evrakAdi?: string;
  evrakId?: string;
  currentDate?: string;
  onSubmit: (payload: { evrakId: string; yeniTarih: string }) => Promise<void> | void;
}
export default function UpdateValidityModal(props: UpdateValidityModalProps) {
  return props.open ? <ValidityDraft {...props} /> : null;
}
function ValidityDraft({onClose, evrakAdi, evrakId, currentDate = "", onSubmit}: UpdateValidityModalProps) {
  const formId = useId();
  const [yeniTarih, setYeniTarih] = useState(currentDate);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const submitting = useRef(false), mounted = useRef(true);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (submitError) { errorRef.current?.focus({preventScroll:true}); errorRef.current?.scrollIntoView({block:"nearest"}); } }, [submitError]);
  const dirty = yeniTarih !== currentDate;
  const canSubmit = !!evrakId && dirty && isDocumentValidityDate(yeniTarih) && !saving;
  function requestClose() { if (submitting.current) return; if (dirty) setDiscardOpen(true); else onClose(); }
  async function handleSubmit() {
    if (!canSubmit || !evrakId || submitting.current) return;
    submitting.current = true; setSaving(true); setSubmitError(null);
    try { await onSubmit({evrakId, yeniTarih}); if (mounted.current) onClose(); }
    catch (error) { if (mounted.current) setSubmitError(error instanceof Error ? error.message : "Geçerlilik güncellenemedi."); }
    finally { submitting.current = false; if (mounted.current) setSaving(false); }
  }
  return <>
    <ModalShell open onClose={requestClose} closeDisabled={saving} title="Gecerlilik Guncelle" footer={<>
      <button type="button" onClick={requestClose} disabled={saving} className="min-h-11 px-4 py-2 text-sm border border-slate-200 rounded-md disabled:opacity-40">Iptal</button>
      <button type="submit" form={formId} disabled={!canSubmit} className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40">{saving ? "Kaydediliyor…" : "Guncelle"}</button>
    </>}>
      <form id={formId} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} aria-busy={saving}>
        <p className="mb-4 break-words text-sm text-slate-600">Evrak: {evrakAdi}</p>
        <label htmlFor={`${formId}-date`} className="block text-sm font-medium text-slate-700 mb-1">Yeni Gecerlilik Tarihi *</label>
        <input id={`${formId}-date`} data-dialog-initial-focus required type="date" value={yeniTarih} onChange={event=>setYeniTarih(event.target.value)} disabled={saving} className="min-h-11 w-full min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <p className="mt-2 text-xs text-slate-500">Belgenin durumu seçilen tarihe göre güncellenir.</p>
        {saving && <p role="status" className="mt-4 text-sm text-blue-700">Geçerlilik kaydediliyor, lütfen bekleyin…</p>}
        {submitError && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 break-words text-sm text-red-600">{submitError}</p>}
      </form>
    </ModalShell>
    {discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler" recordName={evrakAdi ?? "Evrak geçerliliği"} description="Geçerlilik tarihindeki değişiklik bırakılacak." confirmLabel="Değişiklikleri bırak" destructive onClose={()=>setDiscardOpen(false)} onConfirm={async()=>{if(!submitting.current)onClose();}} />}
  </>;
}
