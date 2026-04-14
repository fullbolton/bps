/**
 * Luca Export Reading V1 — Types
 * Management visibility only. Not accounting truth.
 */

export interface LucaMizanRow {
  accountCode: string;
  accountName: string;
  borcTotal: number;
  alacakTotal: number;
  borcBakiyesi: number;
  alacakBakiyesi: number;
  matchedCompanyId: string | null;
  matchedCompanyName: string | null;
  matchStatus: "matched" | "unmatched" | "ambiguous";
}

export interface LucaMizanUploadMeta {
  fileName: string;
  reportPeriod: string | null;
  reportDateRange: string | null;
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  ambiguousCount: number;
}

export interface LucaParseResult {
  meta: LucaMizanUploadMeta;
  rows: LucaMizanRow[];
  errors: string[];
}
