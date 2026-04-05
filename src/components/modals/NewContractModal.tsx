"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";

interface FirmaOption {
  id: string;
  ad: string;
}

interface NewContractModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: FirmaOption[];
}

/**
 * Per WORKFLOW_RULES §3.1: every contract must be linked to a firma.
 * Firma selection is required — submit is disabled without it.
 */
export default function NewContractModal({
  open,
  onClose,
  firmalar,
}: NewContractModalProps) {
  const [sozlesmeAdi, setSozlesmeAdi] = useState("");
  const [firmaId, setFirmaId] = useState("");
  const [tur, setTur] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");

  function handleSubmit() {
    if (!sozlesmeAdi.trim() || !firmaId) return;
    // Demo-only: no real persistence
    console.log("[demo] Yeni sözleşme:", {
      sozlesmeAdi: sozlesmeAdi.trim(),
      firmaId,
      tur,
      baslangic,
      bitis,
    });
    resetAndClose();
  }

  function resetAndClose() {
    setSozlesmeAdi("");
    setFirmaId("");
    setTur("");
    setBaslangic("");
    setBitis("");
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Sözleşme"
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
            disabled={!sozlesmeAdi.trim() || !firmaId}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Oluştur
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sözleşme Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={sozlesmeAdi}
            onChange={(e) => setSozlesmeAdi(e.target.value)}
            placeholder="Sözleşme adını girin"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Firma <span className="text-red-500">*</span>
          </label>
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Firma seçin</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tür
          </label>
          <input
            type="text"
            value={tur}
            onChange={(e) => setTur(e.target.value)}
            placeholder="Sözleşme türü"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Başlangıç
            </label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bitiş
            </label>
            <input
              type="date"
              value={bitis}
              onChange={(e) => setBitis(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
