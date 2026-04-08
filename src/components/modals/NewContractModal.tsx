"use client";

/**
 * NewContractModal — create or edit a contract.
 *
 * Faz 2 change: the modal previously emitted a console.log demo. It
 * now accepts an async `onSubmit` callback that the parent uses to
 * call the contracts service layer. The modal awaits the resolve so
 * service-layer errors (validation, scope, DB) bubble up and render
 * inline instead of silently closing on failure.
 *
 * Per WORKFLOW_RULES §3.1: every contract must be linked to a firma.
 * Firma selection is required — submit is disabled without it.
 *
 * In edit mode (`editData` provided), the firma selector is locked —
 * a contract cannot move between firmas without recreating it.
 */

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";
import type { ContractRow } from "@/types/database.types";

interface FirmaOption {
  id: string;
  ad: string;
}

export interface NewContractSubmitData {
  sozlesmeAdi: string;
  firmaId: string;
  tur: string;
  baslangic: string;
  bitis: string;
  kapsam: string;
  tutar: string;
  sorumlu: string;
}

interface NewContractModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: FirmaOption[];
  /** If provided, the modal is in edit mode. The firma selector locks. */
  editData?: ContractRow | null;
  /** Optional firma to pre-select when creating from a firma context. */
  defaultFirmaId?: string;
  /**
   * Persistence callback. Awaited by the modal so the parent can throw
   * a Turkish-localized error and the modal will surface it inline
   * instead of closing on failure.
   */
  onSubmit: (data: NewContractSubmitData) => Promise<void> | void;
}

export default function NewContractModal({
  open,
  onClose,
  firmalar,
  editData,
  defaultFirmaId,
  onSubmit,
}: NewContractModalProps) {
  const [sozlesmeAdi, setSozlesmeAdi] = useState("");
  const [firmaId, setFirmaId] = useState("");
  const [tur, setTur] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [kapsam, setKapsam] = useState("");
  const [tutar, setTutar] = useState("");
  const [sorumlu, setSorumlu] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEdit = !!editData;

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setSozlesmeAdi(editData.name);
      setFirmaId(editData.company_id);
      setTur(editData.contract_type ?? "");
      setBaslangic(editData.start_date?.slice(0, 10) ?? "");
      setBitis(editData.end_date?.slice(0, 10) ?? "");
      setKapsam(editData.scope ?? "");
      setTutar(editData.contract_value ?? "");
      setSorumlu(editData.responsible ?? "");
    } else {
      setSozlesmeAdi("");
      setFirmaId(defaultFirmaId ?? "");
      setTur("");
      setBaslangic("");
      setBitis("");
      setKapsam("");
      setTutar("");
      setSorumlu("");
    }
    setSaving(false);
    setSubmitError(null);
  }, [editData, defaultFirmaId, open]);

  const isValid = sozlesmeAdi.trim() && firmaId;

  async function handleSubmit() {
    if (!isValid || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({
        sozlesmeAdi: sozlesmeAdi.trim(),
        firmaId,
        tur: tur.trim(),
        baslangic: baslangic.trim(),
        bitis: bitis.trim(),
        kapsam: kapsam.trim(),
        tutar: tutar.trim(),
        sorumlu: sorumlu.trim(),
      });
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    if (saving) return;
    setSozlesmeAdi("");
    setFirmaId("");
    setTur("");
    setBaslangic("");
    setBitis("");
    setKapsam("");
    setTutar("");
    setSorumlu("");
    setSubmitError(null);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title={isEdit ? "Sözleşme Düzenle" : "Yeni Sözleşme"}
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Oluştur"}
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
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Firma <span className="text-red-500">*</span>
          </label>
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            disabled={isEdit || saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Firma seçin</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
          {isEdit && (
            <p className="text-xs text-slate-400 mt-1">
              Sözleşme firması düzenleme modunda değiştirilemez.
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tür
          </label>
          <input
            type="text"
            value={tur}
            onChange={(e) => setTur(e.target.value)}
            placeholder="ör. Hizmet, Ek Protokol"
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
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
              disabled={saving}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sorumlu
          </label>
          <input
            type="text"
            value={sorumlu}
            onChange={(e) => setSorumlu(e.target.value)}
            placeholder="Sorumlu kişi"
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Tutar
          </label>
          <input
            type="text"
            value={tutar}
            onChange={(e) => setTutar(e.target.value)}
            placeholder="₺ tutar (opsiyonel)"
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Kapsam
          </label>
          <textarea
            value={kapsam}
            onChange={(e) => setKapsam(e.target.value)}
            placeholder="Sözleşme kapsamı (opsiyonel)"
            rows={2}
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
          />
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
