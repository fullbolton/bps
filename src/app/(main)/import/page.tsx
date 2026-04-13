"use client";

/**
 * BPS CSV Import V1 — Admin-only import page.
 *
 * Strict CSV-based import for companies, contacts, contracts.
 * Template-based only. No XLSX. No fuzzy matching.
 * Yonetici-only at both UI and action layer.
 */

import { useState, useCallback, useMemo } from "react";
import { Upload, Download, FileText, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui";
import { useRole } from "@/context/RoleContext";
import { createClient } from "@/lib/supabase/client";
import {
  parseCSV,
  validateRows,
} from "@/lib/import/csv-parser";
import type { ImportType, ParseResult } from "@/lib/import/csv-parser";
import {
  buildCompanyNameMap,
  importCompanies,
  importContacts,
  importContracts,
} from "@/lib/import/import-service";
import type { ImportResult } from "@/lib/import/import-service";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  BORDER_SUBTLE,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TEXT_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  TEXT_LINK,
} from "@/styles/tokens";

const IMPORT_TYPES: { key: ImportType; label: string; description: string; template: string }[] = [
  { key: "companies", label: "Firmalar", description: "Firma adi, sektor, sehir, durum, risk", template: "/templates/import_template_companies.csv" },
  { key: "contacts", label: "Yetkililer", description: "Firma adi, ad soyad, unvan, telefon, email", template: "/templates/import_template_contacts.csv" },
  { key: "contracts", label: "Sozlesmeler", description: "Firma adi, sozlesme adi, tur, tarihler, durum", template: "/templates/import_template_contracts.csv" },
];

export default function ImportPage() {
  const { role } = useRole();
  const supabase = createClient();

  const [selectedType, setSelectedType] = useState<ImportType | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Yonetici-only gate
  if (role !== "yonetici") {
    return (
      <>
        <PageHeader title="Veri Aktarimi" subtitle="CSV Import" />
        <EmptyState title="Erisim kisitli" description="Bu sayfa yalnizca yonetici erisimi gerektirir." size="page" />
      </>
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportResult(null);

    if (!file.name.endsWith(".csv")) {
      setError("Yalnizca CSV dosyasi kabul edilir.");
      return;
    }

    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);

      if (rows.length === 0) {
        setError("Dosyada veri satiri bulunamadi.");
        return;
      }

      // For contacts/contracts, build company name resolution map
      let companyMap: Map<string, string> | undefined;
      if (selectedType === "contacts" || selectedType === "contracts") {
        companyMap = await buildCompanyNameMap(supabase);
      }

      const result = validateRows(selectedType!, rows, companyMap);
      setParseResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dosya okunamadi.");
    }

    // Reset file input
    e.target.value = "";
  }

  async function handleConfirmImport() {
    if (!parseResult || !selectedType || importing) return;

    const validRows = parseResult.rows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      let result: ImportResult;

      if (selectedType === "companies") {
        result = await importCompanies(supabase, validRows);
      } else {
        const companyMap = await buildCompanyNameMap(supabase);
        if (selectedType === "contacts") {
          result = await importContacts(supabase, validRows, companyMap);
        } else {
          result = await importContracts(supabase, validRows, companyMap);
        }
      }

      setImportResult(result);
      setParseResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import basarisiz.");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setSelectedType(null);
    setParseResult(null);
    setImportResult(null);
    setError(null);
  }

  return (
    <>
      <PageHeader title="Veri Aktarimi" subtitle="CSV Import \u2014 yalnizca yonetici" />

      <div className="space-y-6 max-w-4xl">

        {/* Step 1: Select import type */}
        {!selectedType && !importResult && (
          <div className="space-y-4">
            <p className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>
              Asagidaki sablonlardan birini indirin, verilerinizi doldurun ve CSV olarak yukleyin.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {IMPORT_TYPES.map((t) => (
                <div
                  key={t.key}
                  className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4 cursor-pointer hover:border-blue-300 transition-colors`}
                  onClick={() => { setSelectedType(t.key); setParseResult(null); setError(null); }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={16} className={TEXT_MUTED} />
                    <h3 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>{t.label}</h3>
                  </div>
                  <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mb-3`}>{t.description}</p>
                  <a
                    href={t.template}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline flex items-center gap-1`}
                  >
                    <Download size={12} />
                    Sablon indir
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload + Preview */}
        {selectedType && !importResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>
                {IMPORT_TYPES.find((t) => t.key === selectedType)?.label} Import
              </h2>
              <button onClick={handleReset} className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>
                Geri
              </button>
            </div>

            {/* Template download */}
            <div className={`${SURFACE_PRIMARY} border border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4 text-center`}>
              <a
                href={IMPORT_TYPES.find((t) => t.key === selectedType)?.template}
                download
                className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline flex items-center justify-center gap-1`}
              >
                <Download size={14} />
                Sablon CSV dosyasini indir
              </a>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>
                Sablonu doldurun, CSV olarak kaydedin ve asagiya yukleyin.
              </p>
              <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
                Tarih formati: GG.AA.YYYY (ornek: 01.01.2026)
              </p>
            </div>

            {/* File upload */}
            {!parseResult && (
              <label className={`block border-2 border-dashed ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors`}>
                <Upload size={32} className={`mx-auto ${TEXT_MUTED} mb-3`} />
                <p className={`${TYPE_BODY} ${TEXT_BODY}`}>CSV dosyasi secmek icin tiklayin</p>
                <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-1`}>Yalnizca .csv dosyalari kabul edilir</p>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            )}

            {/* Validation preview */}
            {parseResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4`}>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-green-600" />
                      <span className={`${TYPE_BODY} text-green-700 font-medium`}>{parseResult.validCount} gecerli</span>
                    </div>
                    {parseResult.invalidCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <XCircle size={14} className="text-red-600" />
                        <span className={`${TYPE_BODY} text-red-700 font-medium`}>{parseResult.invalidCount} hatali</span>
                      </div>
                    )}
                    <span className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
                      toplam {parseResult.rows.length} satir
                    </span>
                  </div>
                </div>

                {/* Row-by-row preview */}
                <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} overflow-hidden`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Satir</th>
                          <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Durum</th>
                          {parseResult.headers.slice(0, 4).map((h) => (
                            <th key={h} className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{h}</th>
                          ))}
                          <th className={`px-3 py-2 text-left ${TYPE_CAPTION} ${TEXT_SECONDARY}`}>Hata</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.rows.map((row) => (
                          <tr key={row.rowIndex} className={`border-t ${BORDER_SUBTLE} ${!row.valid ? "bg-red-50/50" : ""}`}>
                            <td className={`px-3 py-2 ${TYPE_CAPTION} ${TEXT_MUTED}`}>{row.rowIndex}</td>
                            <td className="px-3 py-2">
                              {row.valid
                                ? <CheckCircle size={14} className="text-green-500" />
                                : <XCircle size={14} className="text-red-500" />
                              }
                            </td>
                            {parseResult.headers.slice(0, 4).map((h) => (
                              <td key={h} className={`px-3 py-2 ${TYPE_BODY} ${TEXT_BODY} max-w-[180px] truncate`}>
                                {row.data[h] || "\u2014"}
                              </td>
                            ))}
                            <td className={`px-3 py-2 ${TYPE_CAPTION} text-red-600`}>
                              {row.errors.join("; ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmImport}
                    disabled={parseResult.validCount === 0 || importing}
                    className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {importing ? "Aktariliyor..." : `${parseResult.validCount} gecerli satiri aktar`}
                  </button>
                  <button
                    onClick={() => setParseResult(null)}
                    disabled={importing}
                    className={`px-4 py-2 text-sm font-medium ${TEXT_BODY} bg-white border ${BORDER_DEFAULT} ${RADIUS_SM} hover:bg-slate-50 disabled:opacity-40`}
                  >
                    Iptal
                  </button>
                  {parseResult.invalidCount > 0 && (
                    <p className={`${TYPE_CAPTION} text-amber-600 flex items-center gap-1`}>
                      <AlertTriangle size={12} />
                      Hatali satirlar atlanacak
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Result */}
        {importResult && (
          <div className="space-y-4">
            <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-6 text-center`}>
              <CheckCircle size={32} className="mx-auto text-green-600 mb-3" />
              <h2 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY} mb-2`}>Import Tamamlandi</h2>
              <p className={`${TYPE_BODY} ${TEXT_BODY}`}>
                {importResult.imported} kayit basariyla aktarildi
                {importResult.skipped > 0 && `, ${importResult.skipped} satir atlandi`}
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-3 text-left">
                  <p className={`${TYPE_CAPTION} text-red-600 mb-1`}>Hatalar:</p>
                  {importResult.errors.map((err, i) => (
                    <p key={i} className={`${TYPE_CAPTION} text-red-500`}>{err}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 ${RADIUS_SM} hover:bg-blue-700`}
              >
                Yeni Import
              </button>
              <a href="/firmalar" className={`${TYPE_CAPTION} ${TEXT_LINK} hover:underline`}>
                Firmalara git
              </a>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className={`${RADIUS_DEFAULT} border border-red-200 bg-red-50 p-4 text-sm text-red-700`}>
            {error}
          </div>
        )}
      </div>
    </>
  );
}
