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

// Turkish-locale Excel saves CSV with ";" as the list separator, so both
// "," and ";" must parse. Decide from the header line only: count each
// candidate outside quotes and pick the more frequent one.
function detectDelimiter(text: string): "," | ";" {
  let inQuotes = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ",") commas++;
      else if (ch === ";") semicolons++;
      else if (ch === "\n" || ch === "\r") break;
    }
  }
  return semicolons > commas ? ";" : ",";
}

// RFC-4180 character-level state machine. Unlike a split-on-newline
// approach, a quoted field may contain the delimiter, escaped quotes
// ("") and line breaks without fragmenting the row.
function parseCSVText(text: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
    } else {
      field += ch;
    }
  }
  // Flush the final row when the file does not end with a newline.
  if (field.length > 0 || row.length > 0) pushRow();

  // Drop rows with no content at all (blank / trailing lines).
  return rows.filter((r) => r.some((c) => c.length > 0));
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  // Strip the UTF-8 BOM explicitly (Excel writes one).
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const table = parseCSVText(clean, detectDelimiter(clean));
  if (table.length === 0) return { headers: [], rows: [] };

  const headers = table[0];
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < table.length; i++) {
    const values = table[i];
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

// Mirror of the server's BASIC_EMAIL (`sanitizeContactRow`) — a row that
// previews green must not be rejected at confirm for a rule the preview
// never ran.
const BASIC_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

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

  // Mirror the server (`sanitizeContactRow`) + contacts DB CHECK:
  // at least one of phone / email, and basic email shape if supplied.
  if (!row.phone?.trim() && !row.email?.trim()) {
    errors.push("telefon veya e-posta zorunlu");
  }
  if (row.email?.trim() && !BASIC_EMAIL.test(row.email.trim())) {
    errors.push(`email gecersiz format: "${row.email}"`);
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

  // Mirror the server (`sanitizeContractRow`): a supplied but malformed
  // renewal_target_date must surface in preview too, otherwise it shows a
  // green tick here but is rejected at confirm. Empty stays valid.
  if (row.renewal_target_date?.trim()) {
    if (!parseDDMMYYYY(row.renewal_target_date.trim())) {
      errors.push(`renewal_target_date gecersiz format: "${row.renewal_target_date}" (DD.MM.YYYY olmali)`);
    }
  }

  if (row.status?.trim() && !VALID_CONTRACT_STATUSES.has(row.status.trim())) {
    errors.push(`status gecersiz: "${row.status}"`);
  }

  // Mirror the server's cross-field rules (`sanitizeContractRow`) + the
  // contracts DB CHECKs, so preview and confirm agree:
  //   - aktif / imza_bekliyor require both dates (effective status
  //     mirrors the insert default `status || "taslak"`),
  //   - end_date >= start_date when both parse.
  const effectiveStatus = row.status?.trim() || "taslak";
  if (
    (effectiveStatus === "aktif" || effectiveStatus === "imza_bekliyor") &&
    (!row.start_date?.trim() || !row.end_date?.trim())
  ) {
    errors.push(`status "${effectiveStatus}" icin start_date ve end_date zorunlu`);
  }

  const startIso = row.start_date?.trim() ? parseDDMMYYYY(row.start_date.trim()) : null;
  const endIso = row.end_date?.trim() ? parseDDMMYYYY(row.end_date.trim()) : null;
  if (startIso && endIso && endIso < startIso) {
    errors.push("end_date start_date'den once olamaz");
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
