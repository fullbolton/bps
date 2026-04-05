/**
 * Types for Yönetici İnisiyatifleri / Özel Takip Katmanı.
 *
 * An inisiyatif is a yönetici-owned attention bookmark.
 * It is not a task, not a project, not an announcement.
 * It exists to keep special follow-up items visible to the manager.
 */

export type InisiyatifDurumu = "aktif" | "tamamlandi" | "iptal";

export const INISIYATIF_DURUM_LABELS: Record<InisiyatifDurumu, string> = {
  aktif: "Aktif",
  tamamlandi: "Tamamlandı",
  iptal: "İptal",
};
