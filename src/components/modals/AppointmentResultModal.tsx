"use client";

/**
 * AppointmentResultModal — Phase 3B cutover.
 *
 * Per WORKFLOW_RULES 6.2: tamamlandi cannot be saved unless both
 * sonuc and sonraki aksiyon are present. Submit button stays
 * disabled until both textareas have content.
 *
 * onComplete is now async — the parent awaits the service-layer
 * call (completeAppointment) and this modal shows a saving spinner
 * + inline error on failure. Closing the modal does NOT bypass
 * validation — no partial save.
 */

import { useEffect, useId, useRef, useState } from "react";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { ModalShell } from "@/components/ui";

export interface AppointmentCompletionPayload {
  randevuId?: string;
  sonuc: string;
  sonrakiAksiyon: string;
  actorId: string;
}

interface AppointmentResultModalProps {
  open: boolean;
  onClose: () => void;
  randevuId?: string;
  actorId: string;
  onComplete?: (payload: AppointmentCompletionPayload) => Promise<void> | void;
}

export default function AppointmentResultModal({
  open,
  onClose,
  randevuId,
  actorId,
  onComplete,
}: AppointmentResultModalProps) {
  const formId = useId();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [sonuc, setSonuc] = useState("");
  const [sonrakiAksiyon, setSonrakiAksiyon] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    setDiscardOpen(false);
    if (open) {setSonuc("");setSonrakiAksiyon("");setSubmitError(null);}
  }, [open,randevuId,actorId]);

  const canSubmit = sonuc.trim().length > 0 && sonrakiAksiyon.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting.current || !onComplete) return;
    submitting.current = true;
    const payload: AppointmentCompletionPayload = {
      randevuId,
      sonuc: sonuc.trim(),
      sonrakiAksiyon: sonrakiAksiyon.trim(),
      actorId,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onComplete?.(payload);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Randevu tamamlanırken bir hata oluştu.",
      );
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }

  function resetAndClose() {
    if (submitting.current) return;
    setSonuc("");
    setSonrakiAksiyon("");
    setSubmitError(null);
    onClose();
  }

  function requestClose() {
    if (submitting.current) return;
    if (sonuc.length || sonrakiAksiyon.length) setDiscardOpen(true);
    else resetAndClose();
  }

  return (
    <>
    <ModalShell
      open={open}
      onClose={requestClose}
      closeDisabled={saving}
      title="Randevuyu Tamamla"
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!canSubmit || saving || !onComplete}
            className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
    >
      <form id={formId} className="space-y-4" onSubmit={event => { event.preventDefault(); void handleSubmit(); }}>
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
        <div>
          <label htmlFor={`${formId}-result`} className="block text-sm font-medium text-slate-700 mb-1">
            Görüşme sonucu <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`${formId}-result`}
            data-dialog-initial-focus
            required
            aria-describedby={`${formId}-result-limit`}
            aria-label="Görüşme sonucu"
            value={sonuc}
            onChange={(e) => setSonuc(e.target.value)}
            rows={3}
            maxLength={4000}
            disabled={saving}
            placeholder="Görüşmede alınan kararları yazın…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p id={`${formId}-result-limit`} className="text-xs text-slate-500">{sonuc.length} / 4000 karakter</p>
        </div>
        <div>
          <label htmlFor={`${formId}-next`} className="block text-sm font-medium text-slate-700 mb-1">
            Sonraki aksiyon <span className="text-red-500">*</span>
          </label>
          <textarea
            id={`${formId}-next`}
            required
            aria-describedby={`${formId}-next-limit`}
            aria-label="Sonraki aksiyon"
            value={sonrakiAksiyon}
            onChange={(e) => setSonrakiAksiyon(e.target.value)}
            rows={3}
            maxLength={1000}
            disabled={saving}
            placeholder="Görüşme sonrası yapılacak işi yazın…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <p id={`${formId}-next-limit`} className="text-xs text-slate-500">{sonrakiAksiyon.length} / 1000 karakter</p>
        </div>
        {!canSubmit && (sonuc.trim() || sonrakiAksiyon.trim()) && (
          <p className="text-xs text-amber-600">
            Her iki alan da doldurulmadan randevu tamamlanamaz.
          </p>
        )}
        {saving && <p role="status" className="text-sm text-blue-700">Randevu kaydediliyor, lütfen bekleyin.</p>}
      </form>
    </ModalShell>
    {open && discardOpen && <ConfirmActionDialog
      title="Kaydedilmemiş değişiklikler"
      recordName="Randevu sonucu"
      description="Bu penceredeki görüşme sonucu ve sonraki aksiyon metinleri bırakılacak."
      confirmLabel="Değişiklikleri bırak" destructive
      onClose={() => setDiscardOpen(false)}
      onConfirm={async () => { setDiscardOpen(false); resetAndClose(); }}
    />}
    </>
  );
}
