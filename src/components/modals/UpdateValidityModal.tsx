"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";

interface UpdateValidityModalProps {
  open: boolean;
  onClose: () => void;
  evrakAdi?: string;
  evrakId?: string;
  currentDate?: string;
  onSubmit?: (payload: { evrakId: string; yeniTarih: string }) => void;
}

export default function UpdateValidityModal({ open, onClose, evrakAdi, evrakId, currentDate, onSubmit }: UpdateValidityModalProps) {
  const [yeniTarih, setYeniTarih] = useState(currentDate ?? "");

  function handleSubmit() {
    if (!yeniTarih) return;
    console.log("[demo] Geçerlilik güncelle:", { evrakAdi, yeniGecerlilikTarihi: yeniTarih });
    if (evrakId) onSubmit?.({ evrakId, yeniTarih });
    resetAndClose();
  }

  function resetAndClose() {
    setYeniTarih(currentDate ?? "");
    onClose();
  }

  return (
    <ModalShell open={open} onClose={resetAndClose} title="Geçerlilik Güncelle" footer={
      <>
        <button onClick={resetAndClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">İptal</button>
        <button onClick={handleSubmit} disabled={!yeniTarih} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Güncelle</button>
      </>
    }>
      <div className="space-y-4">
        {evrakAdi && (
          <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-600">Evrak: {evrakAdi}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Geçerlilik Tarihi <span className="text-red-500">*</span></label>
          <input type="date" value={yeniTarih} onChange={(e) => setYeniTarih(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </ModalShell>
  );
}
