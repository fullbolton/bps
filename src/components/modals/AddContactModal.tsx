"use client";

/**
 * AddContactModal — create or edit a firma yetkili kişi.
 *
 * Firm-scoped. Not CRM. Max 5 per firma. Exactly one ana yetkili.
 *
 * The modal is intentionally dumb about persistence: it accepts an
 * existing `ContactRow` for edits and emits a normalized shape via
 * `onSubmit`. The page hosting the modal owns the service-layer call,
 * so this component stays the same whether the back end is the mock
 * source or real Supabase.
 *
 * Phase 1A change: switched the editData type from `MockYetkili` to
 * `ContactRow`, and the emitted shape from camel-cased mock keys
 * (adSoyad/anaYetkili/...) to the service-layer keys
 * (fullName/isPrimary/...). The form's local state still uses Turkish
 * camelCase identifiers because that matches the visible labels and
 * the codebase's Turkish vocabulary.
 *
 * Async onSubmit: the modal awaits the parent's persistence call so it
 * can surface a friendly Turkish error message and only close on
 * success. Validation errors thrown by the service layer
 * (ContactValidationError, ContactLimitReachedError, scope errors) are
 * shown inline above the footer.
 */

import { useState, useEffect, useRef, useId } from "react";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { ModalShell } from "@/components/ui";
import type { ContactRow } from "@/types/database.types";
import {
  TYPE_BODY,
  TYPE_CAPTION,
  TEXT_SECONDARY,
  BORDER_DEFAULT,
  RADIUS_SM,
  BUTTON_BASE,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
} from "@/styles/tokens";

export interface AddContactSubmitData {
  fullName: string;
  title: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  contextNote: string;
}

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  /** If provided, modal is in edit mode */
  editData?: ContactRow | null;
  /** Whether only phone/email fields are editable (operasyon bounded edit) */
  phoneEmailOnly?: boolean;
  /** Name of current ana yetkili (for reassignment warning) */
  currentAnaYetkiliAdi?: string;
  /**
   * Persistence callback. Awaited by the modal so the parent can throw
   * a Turkish-localized error and the modal will surface it instead of
   * closing. The parent is responsible for refreshing its own state
   * after a successful resolve.
   */
  onSubmit: (data: AddContactSubmitData) => Promise<void> | void;
}

export default function AddContactModal(props: AddContactModalProps) {
  return props.open ? <ContactDraft {...props} /> : null;
}

function ContactDraft({
  onClose,
  editData,
  phoneEmailOnly = false,
  currentAnaYetkiliAdi,
  onSubmit,
}: AddContactModalProps) {
  const formId = useId();
  const [adSoyad, setAdSoyad] = useState(editData?.full_name ?? "");
  const [unvan, setUnvan] = useState(editData?.title ?? "");
  const [telefon, setTelefon] = useState(editData?.phone ?? "");
  const [eposta, setEposta] = useState(editData?.email ?? "");
  const [anaYetkili, setAnaYetkili] = useState(editData?.is_primary ?? false);
  const [kisaNotlar, setKisaNotlar] = useState(editData?.context_note ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const hasChanges = telefon !== (editData?.phone ?? "") || eposta !== (editData?.email ?? "") || (!phoneEmailOnly && (
    adSoyad !== (editData?.full_name ?? "") || unvan !== (editData?.title ?? "") || anaYetkili !== (editData?.is_primary ?? false) || kisaNotlar !== (editData?.context_note ?? "")
  ));
  function requestClose() {
    if (submitting.current) return;
    if (hasChanges) setDiscardOpen(true);
    else onClose();
  }

  const isEdit = !!editData;
  const hasContact = telefon.trim() || eposta.trim();
  const isValid = phoneEmailOnly
    ? hasContact
    : adSoyad.trim() && hasContact;

  async function handleSubmit() {
    if (!isValid || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({
        fullName: adSoyad.trim(),
        title: unvan.trim(),
        phone: telefon.trim(),
        email: eposta.trim(),
        isPrimary: anaYetkili,
        contextNote: kisaNotlar.trim(),
      });
      if (mounted.current) onClose();
    } catch (err) {
      if (mounted.current) setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <>
    <ModalShell
      open
      closeDisabled={saving}
      onClose={requestClose}
      title={isEdit ? (phoneEmailOnly ? "İletişim Bilgisi Güncelle" : "Yetkili Düzenle") : "Yeni Yetkili Kişi"}
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className={`${BUTTON_BASE} min-h-11 ${BUTTON_SECONDARY} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!isValid || saving}
            className={`${BUTTON_BASE} min-h-11 ${BUTTON_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Ekle"}
          </button>
        </>
      }
    >
      <form id={formId} aria-busy={saving} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} className="space-y-4">
        {/* Ad Soyad — disabled for phoneEmailOnly */}
        <div>
          <label htmlFor={`${formId}-ad-soyad`} className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
            Ad soyad {!phoneEmailOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            id={`${formId}-ad-soyad`}
            type="text"
            required={!phoneEmailOnly}
            data-dialog-initial-focus={!phoneEmailOnly || undefined}
            value={adSoyad}
            onChange={(e) => setAdSoyad(e.target.value)}
            placeholder="Ad Soyad"
            disabled={phoneEmailOnly || saving}
            autoComplete="name"
            className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
          />
        </div>

        {/* Unvan — disabled for phoneEmailOnly */}
        <div>
          <label htmlFor={`${formId}-unvan`} className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
            Unvan / görev
          </label>
          <input
            id={`${formId}-unvan`}
            type="text"
            value={unvan}
            onChange={(e) => setUnvan(e.target.value)}
            placeholder="ör. Genel Müdür, Operasyon Sorumlusu"
            disabled={phoneEmailOnly || saving}
            className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
          />
        </div>

        {/* Telefon + Eposta — always editable */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${formId}-telefon`} className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
              Telefon
            </label>
            <input
              id={`${formId}-telefon`}
              type="tel"
              data-dialog-initial-focus={phoneEmailOnly || undefined}
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="0532 000 0000"
              autoComplete="tel"
              disabled={saving}
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </div>
          <div>
            <label htmlFor={`${formId}-eposta`} className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
              E-posta
            </label>
            <input
              id={`${formId}-eposta`}
              type="email"
              value={eposta}
              onChange={(e) => setEposta(e.target.value)}
              placeholder="ornek@firma.com"
              autoComplete="email"
              disabled={saving}
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </div>
        </div>
        {!hasContact && (
          <p className={`${TYPE_CAPTION} text-amber-600`}>Telefon veya e-posta alanlarından en az biri gereklidir.</p>
        )}

        {/* Ana Yetkili toggle — disabled for phoneEmailOnly */}
        {!phoneEmailOnly && (
          <>
            <label className={`flex items-center gap-2.5 cursor-pointer ${TYPE_BODY} text-slate-700`}>
              <input
                type="checkbox"
                checked={anaYetkili}
                onChange={(e) => setAnaYetkili(e.target.checked)}
                disabled={saving}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
              />
              Ana yetkili olarak işaretle
            </label>
            {anaYetkili && currentAnaYetkiliAdi && !editData?.is_primary && (
              <p className={`${TYPE_CAPTION} text-amber-600 -mt-2`}>
                Mevcut ana yetkili ({currentAnaYetkiliAdi}) bu işaretleme ile değiştirilecek.
              </p>
            )}
          </>
        )}

        {/* Kısa notlar — disabled for phoneEmailOnly */}
        {!phoneEmailOnly && (
          <div>
            <label htmlFor={`${formId}-kisa-not`} className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
              Kısa not
            </label>
            <input
              id={`${formId}-kisa-not`}
              type="text"
              value={kisaNotlar}
              onChange={(e) => setKisaNotlar(e.target.value)}
              placeholder="Kısa bağlam notu (opsiyonel)"
              disabled={saving}
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </div>
        )}

        {saving && <p role="status" className="text-sm text-blue-700">Yetkili kaydediliyor, lütfen bekleyin…</p>}
        {submitError && (
          <p
            className={`${TYPE_CAPTION} text-red-600`}
            role="alert"
            aria-live="polite"
          >
            {submitError}
          </p>
        )}
      </form>
    </ModalShell>
    {discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler" recordName={isEdit ? "Yetkili düzenlemesi" : "Yeni yetkili kişi"}
      description="Bu formdaki kaydedilmemiş bilgiler bırakılacak." confirmLabel="Değişiklikleri bırak" destructive
      onClose={() => setDiscardOpen(false)} onConfirm={async () => { if (!submitting.current) onClose(); }} />}
    </>
  );
}
