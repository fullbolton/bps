/**
 * BPS — Note tag keys and display labels.
 *
 * Previously hosted in `src/mocks/notlar.ts` alongside the mock note
 * rows. Extracted to a dedicated module as part of Faz 1B (Notlar
 * slice) so the type and label map survive the deletion of the mock
 * source.
 *
 * The keys must match the CHECK constraint on `public.notes.tag`
 * (see supabase/migrations/20260407000400_create_notes.sql — the
 * `notes_tag_whitelist` constraint). Adding a new tag requires BOTH
 * a new migration that extends the CHECK list AND a change here; the
 * two lists are kept deliberately parallel so a missed update fails
 * loudly in typecheck or at insert time.
 */

export type NoteTagKey =
  | "genel"
  | "odeme"
  | "sozlesme"
  | "operasyon"
  | "evrak"
  | "gorusme";

export const NOTE_TAG_LABELS: Record<NoteTagKey, string> = {
  genel: "Genel",
  odeme: "Ödeme",
  sozlesme: "Sözleşme",
  operasyon: "Operasyon",
  evrak: "Evrak",
  gorusme: "Görüşme",
};

/**
 * Narrowing helper used by the service layer to accept "" (empty
 * string, emitted by the modal's "no tag selected" option) as a
 * null tag rather than as a validation error.
 */
export function normalizeNoteTag(value: string | null | undefined): NoteTagKey | null {
  if (!value) return null;
  if (value in NOTE_TAG_LABELS) return value as NoteTagKey;
  return null;
}
