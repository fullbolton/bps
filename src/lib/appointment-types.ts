/**
 * BPS — Appointment type keys and display labels.
 *
 * Previously hosted in `src/mocks/randevular.ts` alongside the mock
 * appointment rows. Extracted to a dedicated module as part of Faz 3
 * so the type and label map survive the deletion of the mock source
 * from migrated readers.
 *
 * The keys must match the CHECK constraint on
 * `public.appointments.meeting_type` (see the Faz 3 migration).
 */

export type AppointmentMeetingType =
  | "ziyaret"
  | "online"
  | "telefon"
  | "teklif_sunumu"
  | "denetim"
  | "diger";

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentMeetingType, string> = {
  ziyaret: "Ziyaret",
  online: "Online Görüşme",
  telefon: "Telefon Görüşmesi",
  teklif_sunumu: "Teklif Sunumu",
  denetim: "Denetim",
  diger: "Diğer",
};
