"use client";

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
  onComplete?: (payload: AppointmentCompletionPayload) => void;
}

/**
 * Per WORKFLOW_RULES §6.2:
 * tamamlandı cannot be saved unless both sonuç and sonraki aksiyon are present.
 * Submit button stays disabled until both textareas have content.
 * Closing the modal does NOT bypass this rule — no partial save.
 */
export default function AppointmentResultModal({
  open,
  onClose,
  randevuId,
  onComplete,
}: AppointmentResultModalProps) {
  const [sonuc, setSonuc] = useState("");
  const [sonrakiAksiyon, setSonrakiAksiyon] = useState("");

  const canSubmit = sonuc.trim().length > 0 && sonrakiAksiyon.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const payload = {
      randevuId,
      sonuc: sonuc.trim(),
      sonrakiAksiyon: sonrakiAksiyon.trim(),
    };
    console.log("[demo] Randevu tamamlandı:", payload);
    onComplete?.(payload);
    resetAndClose();
  }

  function resetAndClose() {
    setSonuc("");
    setSonrakiAksiyon("");
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
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Kaydet
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sonuç <span className="text-red-500">*</span>
          </label>
          <textarea
            value={sonuc}
            onChange={(e) => setSonuc(e.target.value)}
            rows={3}
            placeholder="Görüşme sonucunu yazın..."
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
            placeholder="Sonraki adımı tanımlayın..."
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
