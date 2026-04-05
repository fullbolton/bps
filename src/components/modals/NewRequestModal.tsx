"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";

const ONCELIK_OPTIONS = [
  { value: "dusuk", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "yuksek", label: "Yüksek" },
  { value: "kritik", label: "Kritik" },
];

interface NewRequestModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  onSubmit?: (payload: { firmaId: string; firmaAdi: string; pozisyon: string; adet: number; lokasyon: string; baslangicTarihi: string; oncelik: string; sorumlu: string }) => void;
}

export default function NewRequestModal({ open, onClose, firmalar, onSubmit }: NewRequestModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [pozisyon, setPozisyon] = useState("");
  const [adet, setAdet] = useState("");
  const [lokasyon, setLokasyon] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [oncelik, setOncelik] = useState("normal");
  const [sorumlu, setSorumlu] = useState("");

  const requiresOwner = oncelik === "yuksek" || oncelik === "kritik";
  const canSubmit = !!(firmaId && pozisyon.trim() && adet && (!requiresOwner || sorumlu.trim()));

  function handleSubmit() {
    if (!canSubmit) return;
    const firma = firmalar.find((f) => f.id === firmaId);
    const payload = { firmaId, firmaAdi: firma?.ad ?? "", pozisyon: pozisyon.trim(), adet: Number(adet), lokasyon, baslangicTarihi: baslangic, oncelik, sorumlu: sorumlu.trim() };
    console.log("[demo] Yeni talep:", payload);
    onSubmit?.(payload);
    resetAndClose();
  }

  function resetAndClose() {
    setFirmaId(""); setPozisyon(""); setAdet(""); setLokasyon(""); setBaslangic(""); setOncelik("normal"); setSorumlu("");
    onClose();
  }

  return (
    <ModalShell open={open} onClose={resetAndClose} title="Yeni Personel Talebi" footer={
      <>
        <button onClick={resetAndClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">İptal</button>
        <button onClick={handleSubmit} disabled={!canSubmit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Oluştur</button>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Pozisyon <span className="text-red-500">*</span></label>
            <input type="text" value={pozisyon} onChange={(e) => setPozisyon(e.target.value)} placeholder="Pozisyon adı" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Adet <span className="text-red-500">*</span></label>
            <input type="number" min={1} value={adet} onChange={(e) => setAdet(e.target.value)} placeholder="Kişi sayısı" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lokasyon</label>
            <input type="text" value={lokasyon} onChange={(e) => setLokasyon(e.target.value)} placeholder="Şehir / Lokasyon" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Başlangıç Tarihi</label>
            <input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Öncelik</label>
          <select value={oncelik} onChange={(e) => setOncelik(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            {ONCELIK_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sorumlu {requiresOwner && <span className="text-red-500">*</span>}
          </label>
          <input type="text" value={sorumlu} onChange={(e) => setSorumlu(e.target.value)} placeholder="Sorumlu kişi" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {requiresOwner && !sorumlu.trim() && (
            <p className="mt-1 text-xs text-amber-600">Yüksek ve kritik öncelikli talepler sorumlusuz oluşturulamaz.</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
