/**
 * Luca Mizan Export Parser V1 (hardened)
 *
 * Parses a Luca mizan Excel file, extracts 120.xxx customer receivable
 * leaf rows, normalizes Turkish numbers, and performs deterministic
 * company matching.
 *
 * Management visibility only. Not accounting truth.
 */

import * as XLSX from "xlsx";
import type { LucaMizanRow, LucaMizanUploadMeta, LucaParseResult } from "./types";

// ---------------------------------------------------------------------------
// Turkish numeric normalization — explicit failure, no silent zero-coercion
// ---------------------------------------------------------------------------

interface NumericResult {
  value: number;
  error: string | null;
}

function normalizeTurkishNumber(value: unknown, fieldName: string): NumericResult {
  if (typeof value === "number") return { value, error: null };
  if (value == null || value === "") return { value: 0, error: null }; // blank = 0 is valid
  const str = String(value).trim();
  if (!str) return { value: 0, error: null };
  // Remove thousands dots, replace decimal comma with dot
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  if (isNaN(num)) {
    return { value: 0, error: `${fieldName} gecersiz sayi: "${String(value)}"` };
  }
  return { value: num, error: null };
}

// ---------------------------------------------------------------------------
// Company name normalization (exact deterministic match)
// ---------------------------------------------------------------------------

function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// 120.xxx leaf row detection
// ---------------------------------------------------------------------------

function isCustomerLeafRow(accountCode: string): boolean {
  if (!accountCode.startsWith("120")) return false;
  const segments = accountCode.split(".");
  return segments.length >= 4;
}

// ---------------------------------------------------------------------------
// Header detection
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = ["HESAP KODU", "HESAP ADI", "BORÇ", "ALACAK", "BORÇ BAKİYESİ", "ALACAK BAKİYESİ"];

function findHeaderRow(sheet: XLSX.WorkSheet): { headerRowIndex: number; columnMap: Record<string, number> } | null {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");

  for (let r = range.s.r; r <= Math.min(range.e.r, 20); r++) {
    const rowValues: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      rowValues.push(cell ? String(cell.v ?? "").trim().toLocaleUpperCase("tr-TR") : "");
    }

    const found = REQUIRED_HEADERS.every((h) =>
      rowValues.some((v) => v.includes(h.toLocaleUpperCase("tr-TR")))
    );

    if (found) {
      const columnMap: Record<string, number> = {};
      for (let c = range.s.c; c <= range.e.c; c++) {
        const val = rowValues[c - range.s.c];
        if (val.includes("HESAP KODU")) columnMap["HESAP KODU"] = c;
        else if (val.includes("HESAP ADI")) columnMap["HESAP ADI"] = c;
        else if (val === "BORÇ BAKİYESİ" || val.includes("BORÇ BAKİYESİ")) columnMap["BORÇ BAKİYESİ"] = c;
        else if (val === "ALACAK BAKİYESİ" || val.includes("ALACAK BAKİYESİ")) columnMap["ALACAK BAKİYESİ"] = c;
        else if (val === "BORÇ" || (val.includes("BORÇ") && !val.includes("BAKİYE"))) columnMap["BORÇ"] = c;
        else if (val === "ALACAK" || (val.includes("ALACAK") && !val.includes("BAKİYE"))) columnMap["ALACAK"] = c;
      }

      const allMapped = REQUIRED_HEADERS.every((h) => columnMap[h] !== undefined);
      if (allMapped) return { headerRowIndex: r, columnMap };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Extract metadata from pre-header rows
// ---------------------------------------------------------------------------

function extractMetadata(sheet: XLSX.WorkSheet, headerRowIndex: number): { period: string | null; dateRange: string | null } {
  let period: string | null = null;
  let dateRange: string | null = null;

  for (let r = 0; r < headerRowIndex; r++) {
    const cellA = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const val = cellA ? String(cellA.v ?? "").trim() : "";
    if (val.toLocaleUpperCase("tr-TR").startsWith("DÖNEM")) {
      period = val.replace(/^DÖNEM\s*:\s*/i, "").trim();
    }
    if (val.toLocaleUpperCase("tr-TR").startsWith("TARİH")) {
      dateRange = val.replace(/^TARİH ARALIĞI\s*:\s*/i, "").trim();
    }
  }

  return { period, dateRange };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseMizanExcel(
  buffer: ArrayBuffer,
  fileName: string,
  companyMap: Map<string, { id: string; name: string }[]>,
): LucaParseResult {
  const errors: string[] = [];

  // Parse workbook
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { meta: emptyMeta(fileName), rows: [], errors: ["Dosyada sayfa bulunamadi"] };
  }
  const sheet = workbook.Sheets[sheetName];

  // Find header row
  const headerResult = findHeaderRow(sheet);
  if (!headerResult) {
    return { meta: emptyMeta(fileName), rows: [], errors: ["Luca mizan formati taninmadi. Gerekli basliklar bulunamadi: " + REQUIRED_HEADERS.join(", ")] };
  }

  const { headerRowIndex, columnMap } = headerResult;
  const { period, dateRange } = extractMetadata(sheet, headerRowIndex);
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");

  // Extract data rows
  const rows: LucaMizanRow[] = [];

  for (let r = headerRowIndex + 1; r <= range.e.r; r++) {
    const codeCell = sheet[XLSX.utils.encode_cell({ r, c: columnMap["HESAP KODU"] })];
    const codeVal = codeCell ? String(codeCell.v ?? "").trim() : "";

    // Stop at GENEL TOPLAM
    if (codeVal.toLocaleUpperCase("tr-TR").includes("GENEL TOPLAM")) break;
    const nameCell = sheet[XLSX.utils.encode_cell({ r, c: columnMap["HESAP ADI"] })];
    const nameVal = nameCell ? String(nameCell.v ?? "").trim() : "";
    if (nameVal.toLocaleUpperCase("tr-TR").includes("GENEL TOPLAM")) break;

    // Filter: only 120.xxx leaf rows
    if (!isCustomerLeafRow(codeVal)) continue;

    // Parse numerics with explicit error tracking
    const rowLabel = `${codeVal} (${nameVal.slice(0, 30)})`;
    const borcTotalR = normalizeTurkishNumber(sheet[XLSX.utils.encode_cell({ r, c: columnMap["BORÇ"] })]?.v, "BORC");
    const alacakTotalR = normalizeTurkishNumber(sheet[XLSX.utils.encode_cell({ r, c: columnMap["ALACAK"] })]?.v, "ALACAK");
    const borcBakiyesiR = normalizeTurkishNumber(sheet[XLSX.utils.encode_cell({ r, c: columnMap["BORÇ BAKİYESİ"] })]?.v, "BORC_BAKIYESI");
    const alacakBakiyesiR = normalizeTurkishNumber(sheet[XLSX.utils.encode_cell({ r, c: columnMap["ALACAK BAKİYESİ"] })]?.v, "ALACAK_BAKIYESI");

    const numericErrors = [borcTotalR, alacakTotalR, borcBakiyesiR, alacakBakiyesiR]
      .filter((r) => r.error !== null)
      .map((r) => r.error!);

    if (numericErrors.length > 0) {
      errors.push(`Satir ${rowLabel}: ${numericErrors.join("; ")}`);
    }

    // Match against BPS companies — preserves ambiguity
    const normalizedName = normalizeCompanyName(nameVal);
    const candidates = companyMap.get(normalizedName) ?? [];

    let matchStatus: LucaMizanRow["matchStatus"];
    let matchedId: string | null = null;
    let matchedName: string | null = null;

    if (candidates.length === 1) {
      matchStatus = "matched";
      matchedId = candidates[0].id;
      matchedName = candidates[0].name;
    } else if (candidates.length > 1) {
      matchStatus = "ambiguous";
      // Do NOT assign matchedId/matchedName — ambiguity must not carry a company reference
    } else {
      matchStatus = "unmatched";
    }

    rows.push({
      accountCode: codeVal,
      accountName: nameVal,
      borcTotal: borcTotalR.value,
      alacakTotal: alacakTotalR.value,
      borcBakiyesi: borcBakiyesiR.value,
      alacakBakiyesi: alacakBakiyesiR.value,
      matchedCompanyId: matchedId,
      matchedCompanyName: matchedName,
      matchStatus,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("120.xxx musteri seviyesinde alacak satiri bulunamadi");
  }

  const matchedCount = rows.filter((r) => r.matchStatus === "matched").length;
  const unmatchedCount = rows.filter((r) => r.matchStatus === "unmatched").length;
  const ambiguousCount = rows.filter((r) => r.matchStatus === "ambiguous").length;

  return {
    meta: {
      fileName,
      reportPeriod: period,
      reportDateRange: dateRange,
      totalRows: rows.length,
      matchedCount,
      unmatchedCount,
      ambiguousCount,
    },
    rows,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Build company name → candidates[] map for matching (preserves duplicates)
// ---------------------------------------------------------------------------

export function buildCompanyMatchMap(
  companies: { id: string; name: string }[],
): Map<string, { id: string; name: string }[]> {
  const map = new Map<string, { id: string; name: string }[]>();
  for (const c of companies) {
    const key = normalizeCompanyName(c.name);
    const existing = map.get(key) ?? [];
    existing.push({ id: c.id, name: c.name });
    map.set(key, existing);
  }
  return map;
}

function emptyMeta(fileName: string): LucaMizanUploadMeta {
  return {
    fileName,
    reportPeriod: null,
    reportDateRange: null,
    totalRows: 0,
    matchedCount: 0,
    unmatchedCount: 0,
    ambiguousCount: 0,
  };
}
