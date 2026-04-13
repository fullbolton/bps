/**
 * BPS CSV Import — Parser + Validator (V1)
 *
 * Strict CSV parsing for companies, contacts, contracts.
 * CSV-only, template-based, deterministic company resolution.
 * No XLSX. No fuzzy matching. No hidden company creation.
 */

import { SECTOR_CODES } from "@/lib/sector-codes";
import type { SectorCode } from "@/lib/sector-codes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportType = "companies" | "contacts" | "contracts";

export interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

export interface ParseResult {
  headers: string[];
  rows: ParsedRow[];
  validCount: number;
  invalidCount: number;
}

// ---------------------------------------------------------------------------
// CSV parsing (simple, no external deps)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }

  return { headers, rows };
}

// ---------------------------------------------------------------------------
// Date parsing — DD.MM.YYYY only
// ---------------------------------------------------------------------------

function parseDDMMYYYY(value: string): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = parseInt(dd, 10);
  const m = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  // Real calendar validation: construct Date and verify it round-trips
  const dateObj = new Date(y, m - 1, d);
  if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
    return null; // e.g. 31.02.2026 → Date creates Mar 3 → doesn't round-trip → invalid
  }
  return `${yyyy}-${mm}-${dd}`;
}

// ---------------------------------------------------------------------------
// Company validation
// ---------------------------------------------------------------------------

const VALID_STATUSES = new Set(["aday", "aktif", "pasif"]);
const VALID_RISKS = new Set(["dusuk", "orta", "yuksek"]);
const VALID_SECTOR_CODES = new Set(SECTOR_CODES);

const COMPANIES_REQUIRED = ["name"];
const COMPANIES_OPTIONAL = ["sector", "city", "status", "risk"];
const COMPANIES_ALL = [...COMPANIES_REQUIRED, ...COMPANIES_OPTIONAL];

export function validateCompanyRow(row: Record<string, string>, rowIndex: number): ParsedRow {
  const errors: string[] = [];

  if (!row.name?.trim()) errors.push("name zorunlu");

  if (row.sector?.trim() && !VALID_SECTOR_CODES.has(row.sector.trim() as SectorCode)) {
    errors.push(`sector gecersiz: "${row.sector}" (gecerli: ${SECTOR_CODES.join(", ")})`);
  }

  if (row.status?.trim() && !VALID_STATUSES.has(row.status.trim())) {
    errors.push(`status gecersiz: "${row.status}" (gecerli: aday, aktif, pasif)`);
  }

  if (row.risk?.trim() && !VALID_RISKS.has(row.risk.trim())) {
    errors.push(`risk gecersiz: "${row.risk}" (gecerli: dusuk, orta, yuksek)`);
  }

  return { rowIndex, data: row, errors, valid: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// Contact validation
// ---------------------------------------------------------------------------

const CONTACTS_REQUIRED = ["company_name", "full_name"];

export function validateContactRow(
  row: Record<string, string>,
  rowIndex: number,
  companyNameToId: Map<string, string>,
): ParsedRow {
  const errors: string[] = [];

  if (!row.company_name?.trim()) errors.push("company_name zorunlu");
  if (!row.full_name?.trim()) errors.push("full_name zorunlu");

  if (row.company_name?.trim()) {
    const name = row.company_name.trim();
    if (!companyNameToId.has(name)) {
      errors.push(`company_name eslesmedi: "${name}"`);
    }
  }

  if (row.is_primary?.trim()) {
    const v = row.is_primary.trim().toLowerCase();
    if (!["true", "false", "1", "0", "evet", "hayir"].includes(v)) {
      errors.push(`is_primary gecersiz: "${row.is_primary}" (true/false)`);
    }
  }

  return { rowIndex, data: row, errors, valid: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// Contract validation
// ---------------------------------------------------------------------------

const VALID_CONTRACT_STATUSES = new Set([
  "taslak", "imza_bekliyor", "aktif", "suresi_doldu", "feshedildi",
]);

export function validateContractRow(
  row: Record<string, string>,
  rowIndex: number,
  companyNameToId: Map<string, string>,
): ParsedRow {
  const errors: string[] = [];

  if (!row.company_name?.trim()) errors.push("company_name zorunlu");
  if (!row.name?.trim()) errors.push("name zorunlu");

  if (row.company_name?.trim()) {
    const name = row.company_name.trim();
    if (!companyNameToId.has(name)) {
      errors.push(`company_name eslesmedi: "${name}"`);
    }
  }

  if (row.start_date?.trim()) {
    if (!parseDDMMYYYY(row.start_date.trim())) {
      errors.push(`start_date gecersiz format: "${row.start_date}" (DD.MM.YYYY olmali)`);
    }
  }

  if (row.end_date?.trim()) {
    if (!parseDDMMYYYY(row.end_date.trim())) {
      errors.push(`end_date gecersiz format: "${row.end_date}" (DD.MM.YYYY olmali)`);
    }
  }

  if (row.status?.trim() && !VALID_CONTRACT_STATUSES.has(row.status.trim())) {
    errors.push(`status gecersiz: "${row.status}"`);
  }

  return { rowIndex, data: row, errors, valid: errors.length === 0 };
}

// ---------------------------------------------------------------------------
// Full validation pipeline
// ---------------------------------------------------------------------------

export function validateRows(
  importType: ImportType,
  rawRows: Record<string, string>[],
  companyNameToId?: Map<string, string>,
): ParseResult {
  const rows: ParsedRow[] = [];
  const map = companyNameToId ?? new Map();

  for (let i = 0; i < rawRows.length; i++) {
    let parsed: ParsedRow;
    switch (importType) {
      case "companies":
        parsed = validateCompanyRow(rawRows[i], i + 2); // +2: 1-indexed + header
        break;
      case "contacts":
        parsed = validateContactRow(rawRows[i], i + 2, map);
        break;
      case "contracts":
        parsed = validateContractRow(rawRows[i], i + 2, map);
        break;
    }
    rows.push(parsed);
  }

  const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
  return {
    headers,
    rows,
    validCount: rows.filter((r) => r.valid).length,
    invalidCount: rows.filter((r) => !r.valid).length,
  };
}

// ---------------------------------------------------------------------------
// Convert parsed boolean
// ---------------------------------------------------------------------------

export function parseBooleanish(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "evet";
}

// ---------------------------------------------------------------------------
// Convert date for DB insert
// ---------------------------------------------------------------------------

export function convertDateForDB(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return parseDDMMYYYY(value.trim());
}
