"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";
import type { RandevuTipi } from "@/mocks/randevular";
import { RANDEVU_TIPI_LABELS } from "@/mocks/randevular";

interface NewAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  onSubmit?: (payload: {
    firmaId: string;
    firmaAdi: string;
    tarih: string;
    saat: string;
    gorusmeTipi: RandevuTipi;
    katilimci: string;
  }) => void;
}

export default function NewAppointmentModal({
  open,
  onClose,
  firmalar,
  onSubmit,
}: NewAppointmentModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [tarih, setTarih] = useState("");
  const [saat, setSaat] = useState("");
  const [tip, setTip] = useState<RandevuTipi>("ziyaret");
  const [katilimci, setKatilimci] = useState("");

  function handleSubmit() {
    if (!firmaId || !tarih) return;
    const payload = {
      firmaId,
      firmaAdi: firmalar.find((f) => f.id === firmaId)?.ad ?? "",
      tarih,
      saat,
      gorusmeTipi: tip,
      katilimci,
    };
    console.log("[demo] Yeni randevu:", payload);
    onSubmit?.(payload);
    resetAndClose();
  }

  function resetAndClose() {
    setFirmaId("");
    setTarih("");
    setSaat("");
    setTip("ziyaret");
    setKatilimci("");
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Randevu"
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
            disabled={!firmaId || !tarih}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tarih <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Saat
            </label>
            <input
              type="time"
              value={saat}
              onChange={(e) => setSaat(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Görüşme Tipi
          </label>
          <select
            value={tip}
            onChange={(e) => setTip(e.target.value as RandevuTipi)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(RANDEVU_TIPI_LABELS) as RandevuTipi[]).map((t) => (
              <option key={t} value={t}>
                {RANDEVU_TIPI_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Katılımcı
          </label>
          <input
            type="text"
            value={katilimci}
            onChange={(e) => setKatilimci(e.target.value)}
            placeholder="Katılımcı adı"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </ModalShell>
  );
}
