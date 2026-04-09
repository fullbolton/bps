/**
 * BPS — Document category type extraction module (Phase 4A).
 *
 * Mirrors the CHECK constraint on documents.category in
 * supabase/migrations/20260407001000_create_documents.sql.
 *
 * Replaces `EvrakKategorisi` from `@/types/batch4` for Phase 4 consumers.
 * The batch4 module is retained for Dashboard/Raporlar readers that have
 * not yet been migrated.
 */

export type DocumentCategory =
  | "cerceve_sozlesme"
  | "ek_protokol"
  | "yetki_belgesi"
  | "operasyon_evraki"
  | "teklif_dosyasi"
  | "ziyaret_tutanagi"
  | "diger";

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  cerceve_sozlesme: "Cereve Sozlesme",
  ek_protokol: "Ek Protokol",
  yetki_belgesi: "Yetki Belgesi",
  operasyon_evraki: "Operasyon Evraki",
  teklif_dosyasi: "Teklif Dosyasi",
  ziyaret_tutanagi: "Ziyaret Tutanagi",
  diger: "Diger",
};

/** Normalize a raw string to DocumentCategory, defaulting to 'diger'. */
export function normalizeDocumentCategory(raw: string): DocumentCategory {
  const VALID = new Set<DocumentCategory>([
    "cerceve_sozlesme",
    "ek_protokol",
    "yetki_belgesi",
    "operasyon_evraki",
    "teklif_dosyasi",
    "ziyaret_tutanagi",
    "diger",
  ]);
  return VALID.has(raw as DocumentCategory) ? (raw as DocumentCategory) : "diger";
}
