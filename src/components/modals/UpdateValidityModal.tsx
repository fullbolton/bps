"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui";

interface UpdateValidityModalProps {
  open: boolean;
  onClose: () => void;
  evrakAdi?: string;
  evrakId?: string;
  currentDate?: string;
  onSubmit: (payload: { evrakId: string; yeniTarih: string }) => Promise<void> | void;
}

export default function UpdateValidityModal({ open, onClose, evrakAdi, evrakId, currentDate, onSubmit }: UpdateValidityModalProps) {
  const [yeniTarih, setYeniTarih] = useState(currentDate ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      setYeniTarih(currentDate ?? "");
      setSaving(false);
      setSubmitError(null);
    }
  }, [open, currentDate]);

  async function handleSubmit() {
    if (!yeniTarih || !evrakId || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ evrakId, yeniTarih });
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Gecerlilik guncellenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="Gecerlilik Guncelle" footer={
      <>
        <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Iptal</button>
        <button onClick={handleSubmit} disabled={!yeniTarih || saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? "Kaydediliyor..." : "Guncelle"}
        </button>
      </>
    }>
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
        )}
        {evrakAdi && (
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">Evrak: {evrakAdi}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Gecerlilik Tarihi <span className="text-red-500">*</span></label>
          <input type="date" value={yeniTarih} onChange={(e) => setYeniTarih(e.target.value)} disabled={saving} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </ModalShell>
  );
}
