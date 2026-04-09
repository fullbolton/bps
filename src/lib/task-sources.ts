/**
 * BPS — Task source type keys and display labels.
 *
 * Previously hosted in `src/mocks/gorevler.ts` alongside the mock
 * task rows. Extracted to a dedicated module as part of Faz 3 so the
 * type and label map survive the deletion of the mock source from
 * migrated readers.
 *
 * The keys must match the CHECK constraint on
 * `public.tasks.source_type` (see the Faz 3 migration).
 */

export type TaskSourceType = "manuel" | "randevu" | "sozlesme";

export const TASK_SOURCE_LABELS: Record<TaskSourceType, string> = {
  manuel: "Manuel",
  randevu: "Randevu",
  sozlesme: "Sözleşme",
};
