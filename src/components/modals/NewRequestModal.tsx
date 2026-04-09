"use client";

/**
 * NewRequestModal — create a new staffing demand (Personel Talebi).
 *
 * Faz 3A change: the modal previously emitted a console.log demo. It
 * now accepts an async `onSubmit` callback that the parent uses to
 * call the staffing-demands service layer. The modal awaits the resolve
 * so service-layer errors (validation, scope, DB) bubble up and render
 * inline instead of silently closing on failure.
 *
 * Pattern follows NewContractModal (Faz 2).
 */

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";

const ONCELIK_OPTIONS = [
  { value: "dusuk", label: "Dusuk" },
  { value: "normal", label: "Normal" },
  { value: "yuksek", label: "Yuksek" },
  { value: "kritik", label: "Kritik" },
];

export interface NewRequestSubmitData {
  firmaId: string;
  firmaAdi: string;
  pozisyon: string;
  adet: number;
  lokasyon: string;
  baslangicTarihi: string;
  oncelik: string;
  sorumlu: string;
}

interface NewRequestModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  /**
   * Persistence callback. Awaited by the modal so the parent can throw
   * a Turkish-localized error and the modal will surface it inline
   * instead of closing on failure.
   */
  onSubmit: (payload: NewRequestSubmitData) => Promise<void> | void;
}

export default function NewRequestModal({
  open,
  onClose,
  firmalar,
  onSubmit,
}: NewRequestModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [pozisyon, setPozisyon] = useState("");
  const [adet, setAdet] = useState("");
  const [lokasyon, setLokasyon] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [oncelik, setOncelik] = useState("normal");
  const [sorumlu, setSorumlu] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const requiresOwner = oncelik === "yuksek" || oncelik === "kritik";
  const canSubmit = !!(
    firmaId &&
    pozisyon.trim() &&
    adet &&
    (!requiresOwner || sorumlu.trim())
  );

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!open) return;
    setFirmaId("");
    setPozisyon("");
    setAdet("");
    setLokasyon("");
    setBaslangic("");
    setOncelik("normal");
    setSorumlu("");
    setSaving(false);
    setSubmitError(null);
  }, [open]);

  async function handleSubmit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const firma = firmalar.find((f) => f.id === firmaId);
      await onSubmit({
        firmaId,
        firmaAdi: firma?.ad ?? "",
        pozisyon: pozisyon.trim(),
        adet: Number(adet),
        lokasyon: lokasyon.trim(),
        baslangicTarihi: baslangic.trim(),
        oncelik,
        sorumlu: sorumlu.trim(),
      });
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata olustu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    if (saving) return;
    setFirmaId("");
    setPozisyon("");
    setAdet("");
    setLokasyon("");
    setBaslangic("");
    setOncelik("normal");
    setSorumlu("");
    setSubmitError(null);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Personel Talebi"
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Olustur"}
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
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Firma secin</option>
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
              Pozisyon <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={pozisyon}
              onChange={(e) => setPozisyon(e.target.value)}
              placeholder="Pozisyon adi"
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Adet <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              placeholder="Kisi sayisi"
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Lokasyon
            </label>
            <input
              type="text"
              value={lokasyon}
              onChange={(e) => setLokasyon(e.target.value)}
              placeholder="Sehir / Lokasyon"
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Baslangic Tarihi
            </label>
            <input
              type="date"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Oncelik
          </label>
          <select
            value={oncelik}
            onChange={(e) => setOncelik(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {ONCELIK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sorumlu{" "}
            {requiresOwner && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={sorumlu}
            onChange={(e) => setSorumlu(e.target.value)}
            placeholder="Sorumlu kisi"
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          {requiresOwner && !sorumlu.trim() && (
            <p className="mt-1 text-xs text-amber-600">
              Yuksek ve kritik oncelikli talepler sorumlusuz olusturulamaz.
            </p>
          )}
        </div>
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
      </div>
    </ModalShell>
  );
}
