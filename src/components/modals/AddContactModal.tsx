"use client";

/**
 * AddContactModal — create or edit a firma yetkili kişi.
 * Firm-scoped. Not CRM. Max 5 per firma.
 */

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui";
import type { MockYetkili } from "@/mocks/yetkililer";
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

interface AddContactModalProps {
  open: boolean;
  onClose: () => void;
  /** If provided, modal is in edit mode */
  editData?: MockYetkili | null;
  /** Whether only phone/email fields are editable (operasyon bounded edit) */
  phoneEmailOnly?: boolean;
  /** Name of current ana yetkili (for reassignment warning) */
  currentAnaYetkiliAdi?: string;
  onSubmit: (data: {
    adSoyad: string;
    unvan: string;
    telefon: string;
    eposta: string;
    anaYetkili: boolean;
    kisaNotlar: string;
  }) => void;
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

  useEffect(() => {
    if (editData) {
      setAdSoyad(editData.adSoyad);
      setUnvan(editData.unvan ?? "");
      setTelefon(editData.telefon ?? "");
      setEposta(editData.eposta ?? "");
      setAnaYetkili(editData.anaYetkili);
      setKisaNotlar(editData.kisaNotlar ?? "");
    } else {
      setAdSoyad("");
      setUnvan("");
      setTelefon("");
      setEposta("");
      setAnaYetkili(false);
      setKisaNotlar("");
    }
  }, [editData, open]);

  const isEdit = !!editData;
  const hasContact = telefon.trim() || eposta.trim();
  const isValid = phoneEmailOnly
    ? hasContact
    : adSoyad.trim() && hasContact;

  function handleSubmit() {
    if (!isValid) return;
    onSubmit({
      adSoyad: adSoyad.trim(),
      unvan: unvan.trim(),
      telefon: telefon.trim(),
      eposta: eposta.trim(),
      anaYetkili,
      kisaNotlar: kisaNotlar.trim(),
    });
    onClose();
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
            className={`${BUTTON_BASE} ${BUTTON_SECONDARY}`}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`${BUTTON_BASE} ${BUTTON_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {isEdit ? "Güncelle" : "Ekle"}
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
            disabled={phoneEmailOnly}
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
            disabled={phoneEmailOnly}
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
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
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
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Ana yetkili olarak işaretle
            </label>
            {anaYetkili && currentAnaYetkiliAdi && !(editData?.anaYetkili) && (
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
              className={`w-full px-3 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
        )}
      </div>
    </ModalShell>
  );
}
