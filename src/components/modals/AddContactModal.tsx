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

import { useState, useEffect } from "react";
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

export default function AddContactModal({
  open,
  onClose,
  editData,
  phoneEmailOnly = false,
  currentAnaYetkiliAdi,
  onSubmit,
}: AddContactModalProps) {
  const [adSoyad, setAdSoyad] = useState("");
  const [unvan, setUnvan] = useState("");
  const [telefon, setTelefon] = useState("");
  const [eposta, setEposta] = useState("");
  const [anaYetkili, setAnaYetkili] = useState(false);
  const [kisaNotlar, setKisaNotlar] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (editData) {
      setAdSoyad(editData.full_name);
      setUnvan(editData.title ?? "");
      setTelefon(editData.phone ?? "");
      setEposta(editData.email ?? "");
      setAnaYetkili(editData.is_primary);
      setKisaNotlar(editData.context_note ?? "");
    } else {
      setAdSoyad("");
      setUnvan("");
      setTelefon("");
      setEposta("");
      setAnaYetkili(false);
      setKisaNotlar("");
    }
    setSubmitError(null);
    setSaving(false);
  }, [editData, open]);

  const isEdit = !!editData;
  const hasContact = telefon.trim() || eposta.trim();
  const isValid = phoneEmailOnly
    ? hasContact
    : adSoyad.trim() && hasContact;

  async function handleSubmit() {
    if (!isValid || saving) return;
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
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isEdit ? (phoneEmailOnly ? "İletişim Bilgisi Güncelle" : "Yetkili Düzenle") : "Yeni Yetkili Kişi"}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${BUTTON_BASE} ${BUTTON_SECONDARY} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className={`${BUTTON_BASE} ${BUTTON_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {saving ? "Kaydediliyor…" : isEdit ? "Güncelle" : "Ekle"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Ad Soyad — disabled for phoneEmailOnly */}
        <div>
          <label htmlFor="contact-ad-soyad" className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
            Ad soyad {!phoneEmailOnly && <span className="text-red-500">*</span>}
          </label>
          <input
            id="contact-ad-soyad"
            type="text"
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
          <label htmlFor="contact-unvan" className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
            Unvan / görev
          </label>
          <input
            id="contact-unvan"
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
            <label htmlFor="contact-telefon" className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
              Telefon
            </label>
            <input
              id="contact-telefon"
              type="tel"
              value={telefon}
              onChange={(e) => setTelefon(e.target.value)}
              placeholder="0532 000 0000"
              autoComplete="tel"
              disabled={saving}
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </div>
          <div>
            <label htmlFor="contact-eposta" className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
              E-posta
            </label>
            <input
              id="contact-eposta"
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
            <label htmlFor="contact-kisa-not" className={`block ${TYPE_CAPTION} font-medium ${TEXT_SECONDARY} mb-1`}>
              Kısa not
            </label>
            <input
              id="contact-kisa-not"
              type="text"
              value={kisaNotlar}
              onChange={(e) => setKisaNotlar(e.target.value)}
              placeholder="Kısa bağlam notu (opsiyonel)"
              disabled={saving}
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400`}
            />
          </div>
        )}

        {submitError && (
          <p
            className={`${TYPE_CAPTION} text-red-600`}
            role="alert"
            aria-live="polite"
          >
            {submitError}
          </p>
        )}
      </div>
    </ModalShell>
  );
}
