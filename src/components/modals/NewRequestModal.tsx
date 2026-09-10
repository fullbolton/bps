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

import { useEffect, useState, useRef, useId } from "react";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import NewCompanyModal from "./NewCompanyModal";
import type { CreatedCompany } from "./NewCompanyModal";
import { ModalShell } from "@/components/ui";

const ONCELIK_OPTIONS = [
  { value: "dusuk", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "yuksek", label: "Yüksek" },
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

/**
 * Select icindeki "yeni firma" secenegi — gercek bir id ile cakismamasi
 * icin uuid olmayan sentinel. NewAppointmentModal ile ayni desen.
 */
const NEW_COMPANY_OPTION = "__new_company__";

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
  const submitting = useRef(false);
  const formId = useId();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [firmaId, setFirmaId] = useState("");
  const [pozisyon, setPozisyon] = useState("");
  const [adet, setAdet] = useState("");
  const [lokasyon, setLokasyon] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [oncelik, setOncelik] = useState("normal");
  const [sorumlu, setSorumlu] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companyNotice, setCompanyNotice] = useState<string | null>(null);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  // Inline yaratilanlar — select'te aninda gorunsun diye. Parent kendi
  // listesini talep kaydedildikten sonra zaten yeniliyor.
  const [yeniFirmalar, setYeniFirmalar] = useState<{ id: string; ad: string }[]>([]);

  const tumFirmalar = [
    ...firmalar,
    ...yeniFirmalar.filter((y) => !firmalar.some((f) => f.id === y.id)),
  ];

  function handleCompanyCreated(company: CreatedCompany, origin: "created" | "existing") {
    setCompanyNotice(origin === "created" ? `${company.name} firmalara eklendi ve bu formda seçildi.` : `${company.name} mevcut kayıtlardan seçildi.`);
    setYeniFirmalar((prev) =>
      prev.some((p) => p.id === company.id)
        ? prev
        : [...prev, { id: company.id, ad: company.name }],
    );
    setFirmaId(company.id);
  }

  const requiresOwner = oncelik === "yuksek" || oncelik === "kritik";
  const canSubmit = !!(
    tumFirmalar.some((firma) => firma.id === firmaId) &&
    pozisyon.trim() &&
    Number.isSafeInteger(Number(adet)) && Number(adet) >= 1 &&
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
    submitting.current = false;
    setSaving(false);
    setSubmitError(null);
    setYeniFirmalar([]);
    setCompanyNotice(null);
    setCompanyModalOpen(false);
    setDiscardOpen(false);
  }, [open]);

  async function handleSubmit() {
    if (!canSubmit || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      const firma = tumFirmalar.find((f) => f.id === firmaId);
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
      submitting.current = false;
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function requestClose() {
    if (submitting.current) return;
    if (firmaId || pozisyon || adet || lokasyon || baslangic || oncelik !== "normal" || sorumlu || yeniFirmalar.length) setDiscardOpen(true);
    else resetAndClose();
  }

  function resetAndClose() {
    if (submitting.current) return;
    setDiscardOpen(false);
    setCompanyModalOpen(false);
    setFirmaId("");
    setPozisyon("");
    setAdet("");
    setLokasyon("");
    setBaslangic("");
    setOncelik("normal");
    setSorumlu("");
    setSubmitError(null);
    setYeniFirmalar([]);
    setCompanyNotice(null);
    onClose();
  }

  return (
    <>
    <ModalShell
      open={open}
      onClose={requestClose}
      closeDisabled={saving}
      title="Yeni Personel Talebi"
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!canSubmit || saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </>
      }
    >
      <form id={formId} className="space-y-4" aria-busy={saving} onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
        {saving && <p role="status" className="text-sm text-slate-600">Talep kaydediliyor, lütfen bekleyin…</p>}
        {companyNotice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{companyNotice}</p>}
        <div>
          <label htmlFor={`${formId}-company`} className="block text-sm font-medium text-slate-700 mb-1">
            Firma <span className="text-red-500">*</span>
          </label>
          <select
            id={`${formId}-company`}
            data-dialog-initial-focus
            required
            value={firmaId}
            onChange={(e) => {
              if (e.target.value === NEW_COMPANY_OPTION) {
                setCompanyModalOpen(true);
                return;
              }
              setFirmaId(e.target.value);
            }}
            disabled={saving}
            className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Firma seçin</option>
            {tumFirmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
            <option disabled>──────────────</option>
            <option value={NEW_COMPANY_OPTION}>+ Yeni firma ekle</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-position`} className="block text-sm font-medium text-slate-700 mb-1">
              Pozisyon <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id={`${formId}-position`}
              required
              value={pozisyon}
              onChange={(e) => setPozisyon(e.target.value)}
              placeholder="Pozisyon adı"
              disabled={saving}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-count`} className="block text-sm font-medium text-slate-700 mb-1">
              Adet <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              step={1}
              required
              id={`${formId}-count`}
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              placeholder="Kişi sayısı"
              disabled={saving}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-location`} className="block text-sm font-medium text-slate-700 mb-1">
              Lokasyon
            </label>
            <input
              type="text"
              id={`${formId}-location`}
              value={lokasyon}
              onChange={(e) => setLokasyon(e.target.value)}
              placeholder="Şehir / Lokasyon"
              disabled={saving}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-start`} className="block text-sm font-medium text-slate-700 mb-1">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              id={`${formId}-start`}
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
              disabled={saving}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label htmlFor={`${formId}-priority`} className="block text-sm font-medium text-slate-700 mb-1">
            Öncelik
          </label>
          <select
            id={`${formId}-priority`}
            value={oncelik}
            onChange={(e) => setOncelik(e.target.value)}
            disabled={saving}
            className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          >
            {ONCELIK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${formId}-owner`} className="block text-sm font-medium text-slate-700 mb-1">
            Sorumlu{" "}
            {requiresOwner && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            id={`${formId}-owner`}
            required={requiresOwner}
            aria-describedby={requiresOwner ? `${formId}-owner-help` : undefined}
            value={sorumlu}
            onChange={(e) => setSorumlu(e.target.value)}
            placeholder="Sorumlu kişi"
            disabled={saving}
            className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
          {requiresOwner && (
            <p id={`${formId}-owner-help`} className="mt-1 text-xs text-amber-600">
              Yüksek ve kritik öncelikli talepler sorumlusuz oluşturulamaz.
            </p>
          )}
        </div>
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
      </form>
    </ModalShell>
    {open && discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler"
      recordName={pozisyon.trim() || "Yeni personel talebi"}
      description={yeniFirmalar.length ? "Bu talep formundaki kaydedilmemiş bilgiler bırakılacak. Firma kayıtları silinmez." : "Bu talep formundaki kaydedilmemiş bilgiler bırakılacak."}
      confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardOpen(false)}
      onConfirm={async () => { resetAndClose(); }} />}

    {/* ModalShell'in KARDESI — icine konsaydi modal govdesinin max-h
        kirpmasina takilirdi. */}
    <NewCompanyModal
      open={companyModalOpen}
      onClose={() => setCompanyModalOpen(false)}
      onCreated={handleCompanyCreated}
    />
    </>
  );
}
