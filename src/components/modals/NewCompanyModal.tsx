"use client";

/**
 * NewCompanyModal — inline firma yaratma (B batch).
 *
 * Bu bileşen daha önce vardı ama DEMO'ydu: submit'i `console.log` atıp
 * kapanıyordu ve hiçbir yerden çağrılmıyordu. Alanları (ad / sektör / şehir)
 * `createCompanyAction`'ın girdi şekliyle birebir örtüştüğü için sıfırdan
 * yazmak yerine gerçek yola bağlandı.
 *
 * Randevu ve talep formlarından açılır — ilişkinin BAŞLADIĞI yerler.
 * Sözleşme ve görev formlarında bilerek yok.
 *
 * Mükerrer isim BLOKLAMAZ, sorar. Birincil eylem mevcut firmayı seçmek
 * (kullanıcının asıl istediği genelde bu), ikincil eylem yine de yaratmak.
 * `companies.name` üzerinde unique constraint yok ve iki gerçek firma aynı
 * adı taşıyabilir, o yüzden bloklamak meşru bir kaydı imkânsız kılardı.
 */

import { useState } from "react";
import { ModalShell } from "@/components/ui";
import { SECTOR_CODES, SECTOR_LABELS } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";
import { createCompanyAction } from "@/app/(main)/firmalar/actions";

export interface CreatedCompany {
  id: string;
  name: string;
}

interface DuplicateMatch {
  id: string;
  name: string;
  status: string;
}

interface NewCompanyModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Yaratılan VEYA mükerrer listesinden seçilen firma. Çağıran bunu select'e
   * yerleştirir ve listesini yeniler. İki durum tek callback: çağıran
   * açısından sonuç aynı — elinde kullanılabilir bir firma var.
   */
  onCreated: (company: CreatedCompany) => void;
}

export default function NewCompanyModal({
  open,
  onClose,
  onCreated,
}: NewCompanyModalProps) {
  const [firmaAdi, setFirmaAdi] = useState("");
  const [sektor, setSektor] = useState<SectorCode | "">("");
  const [sehir, setSehir] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  function resetAndClose() {
    setFirmaAdi("");
    setSektor("");
    setSehir("");
    setSaving(false);
    setError(null);
    setDuplicates(null);
    onClose();
  }

  function handleSelectExisting(match: DuplicateMatch) {
    onCreated({ id: match.id, name: match.name });
    resetAndClose();
  }

  async function submit(confirmDuplicate: boolean) {
    const name = firmaAdi.trim();
    if (!name) return;

    setSaving(true);
    setError(null);
    try {
      const result = await createCompanyAction(
        {
          name,
          sector: sektor || undefined,
          city: sehir.trim() || undefined,
        },
        confirmDuplicate ? { confirmDuplicate: true } : undefined,
      );

      if (result.ok) {
        onCreated({ id: result.companyId, name: result.companyName });
        resetAndClose();
        return;
      }

      if (result.reason === "duplicate") {
        setDuplicates(result.duplicates);
        return;
      }

      setError(result.error);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Firma oluşturulamadı.",
      );
    } finally {
      setSaving(false);
    }
  }

  const showingDuplicates = duplicates !== null && duplicates.length > 0;

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Firma"
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
          >
            İptal
          </button>
          <button
            onClick={() => submit(showingDuplicates)}
            disabled={!firmaAdi.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving
              ? "Kaydediliyor…"
              : showingDuplicates
                ? "Yine de oluştur"
                : "Oluştur"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {showingDuplicates && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-900">
              Bu isimde firma zaten var:
            </p>
            <ul className="mt-2 space-y-1">
              {duplicates!.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 text-sm text-amber-900"
                >
                  <span>
                    {m.name}
                    <span className="ml-2 text-xs text-amber-700">
                      ({m.status})
                    </span>
                  </span>
                  <button
                    onClick={() => handleSelectExisting(m)}
                    className="shrink-0 px-2 py-1 text-xs font-medium text-amber-900 bg-white border border-amber-300 rounded hover:bg-amber-100"
                  >
                    Bunu seç
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-700">
              Farklı bir firmaysa alttaki &ldquo;Yine de oluştur&rdquo; ile devam edin.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Firma Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={firmaAdi}
            onChange={(e) => {
              setFirmaAdi(e.target.value);
              // Ad değişti — eski mükerrer listesi artık bu ada ait değil.
              if (duplicates) setDuplicates(null);
            }}
            placeholder="Firma adını girin"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sektor
          </label>
          <select
            value={sektor}
            onChange={(e) => setSektor(e.target.value as SectorCode | "")}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Sektor secin (opsiyonel)</option>
            {SECTOR_CODES.map((code) => (
              <option key={code} value={code}>{SECTOR_LABELS[code]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Şehir
          </label>
          <input
            type="text"
            value={sehir}
            onChange={(e) => setSehir(e.target.value)}
            placeholder="Şehir"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </ModalShell>
  );
}
