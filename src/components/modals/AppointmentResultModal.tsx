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

import { useState } from "react";
import { ModalShell } from "@/components/ui";

export interface AppointmentCompletionPayload {
  randevuId?: string;
  sonuc: string;
  sonrakiAksiyon: string;
}

interface AppointmentResultModalProps {
  open: boolean;
  onClose: () => void;
  randevuId?: string;
  onComplete?: (payload: AppointmentCompletionPayload) => Promise<void> | void;
}

export default function AppointmentResultModal({
  open,
  onClose,
  randevuId,
  onComplete,
}: AppointmentResultModalProps) {
  const [sonuc, setSonuc] = useState("");
  const [sonrakiAksiyon, setSonrakiAksiyon] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = sonuc.trim().length > 0 && sonrakiAksiyon.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    const payload: AppointmentCompletionPayload = {
      randevuId,
      sonuc: sonuc.trim(),
      sonrakiAksiyon: sonrakiAksiyon.trim(),
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onComplete?.(payload);
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Randevu tamamlanirken bir hata olustu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setSonuc("");
    setSonrakiAksiyon("");
    setSubmitError(null);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Randevuyu Tamamla"
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sonuc <span className="text-red-500">*</span>
          </label>
          <textarea
            value={sonuc}
            onChange={(e) => setSonuc(e.target.value)}
            rows={3}
            placeholder="Gorusme sonucunu yazin..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sonraki Aksiyon <span className="text-red-500">*</span>
          </label>
          <textarea
            value={sonrakiAksiyon}
            onChange={(e) => setSonrakiAksiyon(e.target.value)}
            rows={3}
            placeholder="Sonraki adimi tanimlayiniz..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        {!canSubmit && (sonuc.trim() || sonrakiAksiyon.trim()) && (
          <p className="text-xs text-amber-600">
            Her iki alan da doldurulmadan randevu tamamlanamaz.
          </p>
        )}
      </div>
    </ModalShell>
  );
}
