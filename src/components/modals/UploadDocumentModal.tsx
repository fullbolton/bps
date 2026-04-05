"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";
import { KATEGORI_LABELS } from "@/types/batch4";
import type { EvrakKategorisi } from "@/types/batch4";

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  onSubmit?: (payload: { firmaId: string; firmaAdi: string; evrakAdi: string; kategori: EvrakKategorisi; gecerlilikTarihi: string }) => void;
}

export default function UploadDocumentModal({ open, onClose, firmalar, onSubmit }: UploadDocumentModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [evrakAdi, setEvrakAdi] = useState("");
  const [kategori, setKategori] = useState<EvrakKategorisi>("diger");
  const [gecerlilik, setGecerlilik] = useState("");

  function handleSubmit() {
    if (!firmaId || !evrakAdi.trim()) return;
    const firma = firmalar.find((f) => f.id === firmaId);
    const payload = { firmaId, firmaAdi: firma?.ad ?? "", evrakAdi: evrakAdi.trim(), kategori, gecerlilikTarihi: gecerlilik };
    console.log("[demo] Evrak yükle:", payload);
    onSubmit?.(payload);
    resetAndClose();
  }

  function resetAndClose() {
    setFirmaId(""); setEvrakAdi(""); setKategori("diger"); setGecerlilik("");
    onClose();
  }

  return (
    <ModalShell open={open} onClose={resetAndClose} title="Evrak Yükle" footer={
      <>
        <button onClick={resetAndClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">İptal</button>
        <button onClick={handleSubmit} disabled={!firmaId || !evrakAdi.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Yükle</button>
      </>
    }>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Firma <span className="text-red-500">*</span></label>
          <select value={firmaId} onChange={(e) => setFirmaId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Firma seçin</option>
            {firmalar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Evrak Adı <span className="text-red-500">*</span></label>
          <input type="text" value={evrakAdi} onChange={(e) => setEvrakAdi(e.target.value)} placeholder="Evrak adını girin" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
            <select value={kategori} onChange={(e) => setKategori(e.target.value as EvrakKategorisi)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(Object.keys(KATEGORI_LABELS) as EvrakKategorisi[]).map((k) => <option key={k} value={k}>{KATEGORI_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Geçerlilik Tarihi</label>
            <input type="date" value={gecerlilik} onChange={(e) => setGecerlilik(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
