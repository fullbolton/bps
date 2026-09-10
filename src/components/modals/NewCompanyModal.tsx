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

import { useState, useRef, useId } from "react";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
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
   * yerleştirir ve listesini yeniler. İki durum tek callback: SELECT ALANI
   * olan çağıranlar açısından sonuç aynı — elinde kullanılabilir bir firma var.
   *
   * `origin` bu iki durumu yine de ayırt edilebilir tutar. Select alanı olan
   * çağıranlar (randevu · talep) parametreyi yok sayar. Firmalar LİSTESİ ise
   * ayırmak zorunda: orada kullanıcıya bir sonuç cümlesi yazılıyor ve
   * "eklendi" demek, mükerrer listesinden mevcut bir firma seçildiğinde
   * DOĞRU DEĞİL. Tek callback'te birleştirmek o cümleyi iki durumdan birinde
   * yalan yapardı.
   */
  onCreated: (
    company: CreatedCompany,
    origin: "created" | "existing",
  ) => void;
}

export default function NewCompanyModal({
  open,
  onClose,
  onCreated,
}: NewCompanyModalProps) {
  const submitting = useRef(false);
  const fieldId = useId();
  const [firmaAdi, setFirmaAdi] = useState("");
  const [sektor, setSektor] = useState<SectorCode | "">("");
  const [sehir, setSehir] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  const [discardOpen, setDiscardOpen] = useState(false);
  const formId = `${fieldId}-form`;

  function requestClose() {
    if (submitting.current) return;
    if (firmaAdi !== "" || sektor !== "" || sehir !== "") setDiscardOpen(true);
    else resetAndClose();
  }

  function resetAndClose() {
    if (submitting.current) return;
    setDiscardOpen(false);
    setFirmaAdi("");
    setSektor("");
    setSehir("");
    setSaving(false);
    setError(null);
    setDuplicates(null);
    onClose();
  }

  function handleSelectExisting(match: DuplicateMatch) {
    if (submitting.current) return;
    onCreated({ id: match.id, name: match.name }, "existing");
    resetAndClose();
  }

  async function submit(confirmDuplicate: boolean) {
    if (submitting.current) return;
    const name = firmaAdi.trim();
    if (!name) return;

    submitting.current = true;
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
        submitting.current = false;
        onCreated(
          { id: result.companyId, name: result.companyName },
          "created",
        );
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
      submitting.current = false;
      setSaving(false);
    }
  }

  const showingDuplicates = duplicates !== null && duplicates.length > 0;

  return (
    <>
    <ModalShell
      open={open}
      onClose={requestClose}
      closeDisabled={saving}
      title="Yeni Firma"
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
          >
            İptal
          </button>
          <button
            type={showingDuplicates ? "button" : "submit"}
            form={formId}
            onClick={showingDuplicates ? () => void submit(true) : undefined}
            disabled={!firmaAdi.trim() || saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
      <form id={formId} className="space-y-4" aria-busy={saving} onSubmit={(event) => {
        event.preventDefault();
        // Enter must never confirm creating a duplicate implicitly.
        if (!showingDuplicates) void submit(false);
      }}>
        {saving && <p role="status" className="text-sm text-slate-600">Firma kaydediliyor, lütfen bekleyin…</p>}
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
                    type="button"
                    disabled={saving}
                    onClick={() => handleSelectExisting(m)}
                    className="min-h-11 shrink-0 px-2 py-1 text-xs font-medium text-amber-900 bg-white border border-amber-300 rounded hover:bg-amber-100"
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
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor={`${fieldId}-name`} className="block text-sm font-medium text-slate-700 mb-1">
            Firma Adı <span className="text-red-500">*</span>
          </label>
          <input
            id={`${fieldId}-name`}
            disabled={saving}
            data-dialog-initial-focus
            required
            type="text"
            value={firmaAdi}
            onChange={(e) => {
              setFirmaAdi(e.target.value);
              // Ad değişti — eski mükerrer listesi artık bu ada ait değil.
              if (duplicates) setDuplicates(null);
            }}
            placeholder="Firma adını girin"
            className="min-h-11 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor={`${fieldId}-sector`} className="block text-sm font-medium text-slate-700 mb-1">
            Sektör
          </label>
          <select
            id={`${fieldId}-sector`}
            disabled={saving}
            value={sektor}
            onChange={(e) => setSektor(e.target.value as SectorCode | "")}
            className="min-h-11 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Sektör seçin (isteğe bağlı)</option>
            {SECTOR_CODES.map((code) => (
              <option key={code} value={code}>{SECTOR_LABELS[code]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${fieldId}-city`} className="block text-sm font-medium text-slate-700 mb-1">
            Şehir
          </label>
          <input
            id={`${fieldId}-city`}
            disabled={saving}
            type="text"
            value={sehir}
            onChange={(e) => setSehir(e.target.value)}
            placeholder="Şehir"
            className="min-h-11 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </ModalShell>
    {open && discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler"
      recordName={firmaAdi.trim() || "Yeni firma"}
      description="Bu firma formundaki kaydedilmemiş bilgiler bırakılacak."
      confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardOpen(false)}
      onConfirm={async () => { resetAndClose(); }} />}
    </>
  );
}
