"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";
import { SECTOR_CODES, SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";

interface NewCompanyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function NewCompanyModal({ open, onClose }: NewCompanyModalProps) {
  const [firmaAdi, setFirmaAdi] = useState("");
  const [sektor, setSektor] = useState<SectorCode | "">("");
  const [sehir, setSehir] = useState("");

  function handleSubmit() {
    if (!firmaAdi.trim()) return;
    // Demo-only: no real persistence
    console.log("[demo] Yeni firma:", { firmaAdi: firmaAdi.trim(), sektor, sehir });
    resetAndClose();
  }

  function resetAndClose() {
    setFirmaAdi("");
    setSektor("");
    setSehir("");
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Firma"
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
            disabled={!firmaAdi.trim()}
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
            Firma Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={firmaAdi}
            onChange={(e) => setFirmaAdi(e.target.value)}
            placeholder="Firma adını girin"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sektor
          </label>
          <select
            value={sektor}
            onChange={(e) => setSektor(e.target.value as SectorCode | "")}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Sektor secin (opsiyonel)</option>
            {SECTOR_CODES.map((code) => (
              <option key={code} value={code}>{SECTOR_LABELS[code]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Şehir
          </label>
          <input
            type="text"
            value={sehir}
            onChange={(e) => setSehir(e.target.value)}
            placeholder="Şehir"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </ModalShell>
  );
}
