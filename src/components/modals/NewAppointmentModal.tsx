"use client";

/**
 * NewAppointmentModal — Phase 3B cutover.
 *
 * Imports moved from mocks/randevular to lib/appointment-types.
 * onSubmit is now async — the parent awaits the service-layer call
 * and this modal shows a saving spinner + inline error on failure.
 */

import { useEffect, useId, useRef, useState } from "react";
import { ModalShell } from "@/components/ui";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import PickerFeedback, {type PickerStatus} from "@/components/ui/PickerFeedback";
import NewCompanyModal from "./NewCompanyModal";
import type { CreatedCompany } from "./NewCompanyModal";
import type { AppointmentMeetingType } from "@/lib/appointment-types";

/**
 * Select icindeki "yeni firma" secenegi. Gercek bir firma id'siyle
 * cakismamasi icin uuid olmayan bir sentinel.
 */
const NEW_COMPANY_OPTION = "__new_company__";

interface NewAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  firmalarDurum?: PickerStatus;
  onRetryFirmalar?: () => void;
  defaultFirmaId?: string;
  allowNewCompany?: boolean;
  onSubmit: (payload: {
    firmaId: string;
    firmaAdi: string;
    tarih: string;
    saat: string;
    gorusmeTipi: AppointmentMeetingType;
    katilimci: string;
  }) => Promise<void> | void;
}

export default function NewAppointmentModal({
  open,
  onClose,
  firmalar,
  firmalarDurum = "ready",
  onRetryFirmalar,
  defaultFirmaId = "",
  allowNewCompany = true,
  onSubmit,
}: NewAppointmentModalProps) {
  const formId = useId();
  const [firmaId, setFirmaId] = useState(defaultFirmaId);
  const submitting = useRef(false);
  const [tarih, setTarih] = useState("");
  const [saat, setSaat] = useState("");
  const [tip, setTip] = useState<AppointmentMeetingType>("ziyaret");
  const [katilimci, setKatilimci] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [companyNotice, setCompanyNotice] = useState<string | null>(null);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  // Bu oturumda inline yaratilan firmalar. Parent kendi listesini randevu
  // kaydedildikten sonra zaten yeniliyor; buradaki amac yeni firmanin
  // select'te ANINDA gorunmesi, sayfa reload etmeden.
  const [yeniFirmalar, setYeniFirmalar] = useState<{ id: string; ad: string }[]>([]);

  useEffect(() => {
    setFirmaId(defaultFirmaId);
    setTarih("");
    setSaat("");
    setTip("ziyaret");
    setKatilimci("");
    setSubmitError(null);
    setCompanyModalOpen(false);
    setYeniFirmalar([]);
    setCompanyNotice(null);
  }, [open, defaultFirmaId]);

  const tumFirmalar = [
    ...firmalar,
    ...yeniFirmalar.filter((y) => !firmalar.some((f) => f.id === y.id)),
  ];

  const companyValid = firmalarDurum === "ready" && tumFirmalar.some(f => f.id === firmaId);

  function handleCompanyCreated(company: CreatedCompany, origin: "created" | "existing") {
    setCompanyNotice(origin === "created" ? `${company.name} firmalara eklendi ve bu formda seçildi.` : `${company.name} mevcut kayıtlardan seçildi.`);
    setYeniFirmalar((prev) =>
      prev.some((p) => p.id === company.id)
        ? prev
        : [...prev, { id: company.id, ad: company.name }],
    );
    setFirmaId(company.id);
  }

  async function handleSubmit() {
    if (!companyValid || !tarih || submitting.current) return;
    submitting.current = true;
    const payload = {
      firmaId,
      firmaAdi: tumFirmalar.find((f) => f.id === firmaId)?.ad ?? "",
      tarih,
      saat,
      gorusmeTipi: tip,
      katilimci,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Randevu oluşturulurken bir hata oluştu.",
      );
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }

  function resetAndClose() {
    if (submitting.current) return;
    setCompanyModalOpen(false);
    setFirmaId("");
    setTarih("");
    setSaat("");
    setTip("ziyaret");
    setKatilimci("");
    setSubmitError(null);
    setYeniFirmalar([]);
    setCompanyNotice(null);
    onClose();
  }

  return (
    <>
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Randevu"
      footer={
        <>
          <button
            type="button"
            onClick={resetAndClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!companyValid || !tarih || saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} aria-describedby={`${formId}-help`}>
        <p id={`${formId}-help`} className="mb-4 text-sm text-slate-500">* işaretli alanlar zorunludur. Diğer bilgileri daha sonra tamamlayabilirsiniz.</p>
        {saving && <p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Kaydediliyor, lütfen bekleyin…</p>}
        <fieldset disabled={saving} aria-busy={saving} className="min-w-0 space-y-4">
          {companyNotice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{companyNotice}</p>}
          {submitError && (
            <p className="text-xs text-red-600" role="alert" aria-live="polite">
              {submitError}
            </p>
          )}
          <div>
            <label htmlFor={`${formId}-firmaId`} className="block text-sm font-medium text-slate-700 mb-1">
              Firma <span className="text-red-500">*</span>
            </label>
            <select required data-dialog-initial-focus id={`${formId}-firmaId`}
              aria-label="Randevu firması"
              disabled={firmalarDurum !== "ready"}
              aria-describedby={firmalarDurum !== "ready" || tumFirmalar.length === 0 ? `${formId}-companies` : undefined}
              value={firmaId}
              onChange={(e) => {
                if (allowNewCompany && e.target.value === NEW_COMPANY_OPTION) {
                  setCompanyModalOpen(true);
                  return;
                }
                setFirmaId(e.target.value);
              }}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{firmalarDurum === "loading" ? "Firmalar yükleniyor…" : firmalarDurum === "error" ? "Firma listesi yüklenemedi" : "Firma seçin"}</option>
              {firmaId && !tumFirmalar.some(f => f.id === firmaId) && <option value={firmaId} disabled>{firmalarDurum === "ready" ? "Seçili firma listede yok" : "Seçili firma doğrulanıyor"}</option>}
              {tumFirmalar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
              {allowNewCompany && <>
                <option disabled>──────────────</option>
                <option value={NEW_COMPANY_OPTION}>+ Yeni firma ekle</option>
              </>}
            </select>
            <PickerFeedback id={`${formId}-companies`} status={firmalarDurum} count={tumFirmalar.length} name="Firma listesi"
              emptyText="Listede firma yok." onRetry={onRetryFirmalar} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-tarih`} className="block text-sm font-medium text-slate-700 mb-1">
                Tarih <span className="text-red-500">*</span>
              </label>
              <input required id={`${formId}-tarih`}
                type="date"
                aria-label="Randevu tarihi"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-saat`} className="block text-sm font-medium text-slate-700 mb-1">
                Saat
              </label>
              <input id={`${formId}-saat`}
                type="time"
                aria-label="Randevu saati"
                value={saat}
                onChange={(e) => setSaat(e.target.value)}
                className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-tip`} className="block text-sm font-medium text-slate-700 mb-1">
              Görüşme Tipi
            </label>
            <select id={`${formId}-tip`}
              aria-label="Görüşme tipi"
              value={tip}
              onChange={(e) => setTip(e.target.value as AppointmentMeetingType)}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentMeetingType[]).map((t) => (
                <option key={t} value={t}>
                  {APPOINTMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-katilimci`} className="block text-sm font-medium text-slate-700 mb-1">
              Katılımcı
            </label>
            <input id={`${formId}-katilimci`}
              type="text"
              aria-label="Katılımcı"
              value={katilimci}
              onChange={(e) => setKatilimci(e.target.value)}
              placeholder="Katılımcı adı"
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </fieldset>
      </form>
    </ModalShell>

    {/* ModalShell'in KARDESI — icine konsaydi modal govdesinin max-h
        kirpmasina takilirdi. Ustte cizilmesi DOM sirasindan geliyor;
        ikisi de z-50. */}
    <NewCompanyModal
      open={companyModalOpen}
      onClose={() => setCompanyModalOpen(false)}
      onCreated={handleCompanyCreated}
    />
    </>
  );
}
