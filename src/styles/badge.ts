/**
 * BPS Badge Utilities
 *
 * Shared anatomy, size variants, and color-group lookups
 * consumed by StatusBadge, RiskBadge, PriorityBadge.
 *
 * Derived from docs/design/design-tokens.md §12 Badge Mapping Guidance.
 */

import {
  COLOR_POSITIVE,
  COLOR_INTERACTIVE,
  COLOR_WARNING,
  COLOR_DANGER,
  COLOR_NEUTRAL,
  COLOR_ACCENT,
  DOT_POSITIVE,
  DOT_WARNING,
  DOT_DANGER,
  RADIUS_FULL,
} from "./tokens";

// ---------------------------------------------------------------------------
// Base anatomy — shared by all badge types
// ---------------------------------------------------------------------------

export const BADGE_BASE = `inline-flex items-center ${RADIUS_FULL} font-medium ring-1 ring-inset`;

// ---------------------------------------------------------------------------
// Size variants
// ---------------------------------------------------------------------------

export const BADGE_SIZE = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
} as const;

export type BadgeSize = keyof typeof BADGE_SIZE;

// ---------------------------------------------------------------------------
// Dot indicator (for RiskBadge, WorkforceRiskBadge)
// ---------------------------------------------------------------------------

export const BADGE_DOT = "w-1.5 h-1.5 rounded-full";
export const BADGE_DOT_GAP = "gap-1.5"; // between dot and label

// ---------------------------------------------------------------------------
// Color groups — the 5 semantic groups per design-tokens.md
// ---------------------------------------------------------------------------

export const BADGE_COLOR = {
  positive: COLOR_POSITIVE,
  interactive: COLOR_INTERACTIVE,
  warning: COLOR_WARNING,
  danger: COLOR_DANGER,
  neutral: COLOR_NEUTRAL,
} as const;

export const BADGE_DOT_COLOR = {
  positive: DOT_POSITIVE,
  warning: DOT_WARNING,
  danger: DOT_DANGER,
} as const;

// ---------------------------------------------------------------------------
// Status → color group mapping (StatusBadge)
// Per design-tokens.md §12 "Status Badges"
// ---------------------------------------------------------------------------

export const STATUS_COLOR_MAP: Record<string, string> = {
  // positive (green)
  aktif: BADGE_COLOR.positive,
  tamamlandi: BADGE_COLOR.positive,
  tam: BADGE_COLOR.positive,
  tamamen_doldu: BADGE_COLOR.positive,

  // interactive (blue)
  taslak: BADGE_COLOR.interactive,
  imza_bekliyor: BADGE_COLOR.interactive,
  degerlendiriliyor: BADGE_COLOR.interactive,
  devam_ediyor: BADGE_COLOR.interactive,
  planlandi: BADGE_COLOR.interactive,
  yeni: BADGE_COLOR.interactive,

  // warning (amber)
  aday: BADGE_COLOR.warning,
  beklemede: BADGE_COLOR.warning,
  kismi_doldu: BADGE_COLOR.warning,
  suresi_yaklsiyor: BADGE_COLOR.warning,
  ertelendi: BADGE_COLOR.warning,
  acik: BADGE_COLOR.warning,

  // danger (red)
  suresi_doldu: BADGE_COLOR.danger,
  feshedildi: BADGE_COLOR.danger,
  gecikti: BADGE_COLOR.danger,
  iptal: BADGE_COLOR.danger,
  eksik: BADGE_COLOR.danger,

  // neutral (slate)
  pasif: BADGE_COLOR.neutral,
};

export const STATUS_DEFAULT_COLOR = BADGE_COLOR.neutral;

// ---------------------------------------------------------------------------
// Status → Turkish label mapping (StatusBadge)
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<string, string> = {
  // Firma
  aday: "Aday",
  aktif: "Aktif",
  pasif: "Pasif",
  // Sözleşme
  taslak: "Taslak",
  imza_bekliyor: "İmza Bekliyor",
  suresi_doldu: "Süresi Doldu",
  feshedildi: "Feshedildi",
  // Talep
  yeni: "Yeni",
  degerlendiriliyor: "Değerlendiriliyor",
  kismi_doldu: "Kısmi Doldu",
  tamamen_doldu: "Tamamen Doldu",
  beklemede: "Beklemede",
  iptal: "İptal",
  // Görev
  acik: "Açık",
  devam_ediyor: "Devam Ediyor",
  tamamlandi: "Tamamlandı",
  gecikti: "Gecikti",
  // Evrak
  tam: "Tam",
  eksik: "Eksik",
  suresi_yaklsiyor: "Süresi Yaklaşıyor",
  // Randevu
  planlandi: "Planlandı",
  ertelendi: "Ertelendi",
};

// ---------------------------------------------------------------------------
// Risk → color/dot/label mapping (RiskBadge)
// ---------------------------------------------------------------------------

import type { RiskSeviyesi } from "@/types/ui";

export const RISK_CONFIG: Record<RiskSeviyesi, { label: string; color: string; dot: string }> = {
  dusuk: { label: "Düşük", color: BADGE_COLOR.positive, dot: BADGE_DOT_COLOR.positive },
  orta: { label: "Orta", color: BADGE_COLOR.warning, dot: BADGE_DOT_COLOR.warning },
  yuksek: { label: "Yüksek", color: BADGE_COLOR.danger, dot: BADGE_DOT_COLOR.danger },
};

// ---------------------------------------------------------------------------
// Priority → color/label mapping (PriorityBadge)
// Per design-tokens.md: düşük=neutral, normal=interactive, yüksek=warning, kritik=danger
// ---------------------------------------------------------------------------

import type { OncelikSeviyesi } from "@/types/ui";

/** PriorityBadge uses slate-50 for düşük (slightly different from BADGE_COLOR.neutral which is slate-100) */
const PRIORITY_NEUTRAL = "bg-slate-50 text-slate-600 ring-slate-500/20";

export const PRIORITY_CONFIG: Record<OncelikSeviyesi, { label: string; color: string }> = {
  dusuk: { label: "Düşük", color: PRIORITY_NEUTRAL },
  normal: { label: "Normal", color: BADGE_COLOR.interactive },
  yuksek: { label: "Yüksek", color: BADGE_COLOR.warning },
  kritik: { label: "Kritik", color: BADGE_COLOR.danger },
};

// ---------------------------------------------------------------------------
// Task Source → color/label mapping (TaskSourceBadge)
// Icons remain in the component file (React elements, not plain strings)
// Per design-tokens.md §12: manuel=accent(purple), randevu=interactive(blue), sozlesme=neutral(slate)
// ---------------------------------------------------------------------------

import type { TaskSourceType } from "@/lib/task-sources";

/** TaskSourceBadge uses slate-50 for sozlesme (same lighter neutral as PriorityBadge düşük) */
const TASK_SOURCE_NEUTRAL = "bg-slate-50 text-slate-600 ring-slate-500/20";

export const TASK_SOURCE_CONFIG: Record<TaskSourceType, { label: string; color: string }> = {
  manuel: { label: "Manuel", color: COLOR_ACCENT },
  randevu: { label: "Randevu", color: BADGE_COLOR.interactive },
  sozlesme: { label: "Sözleşme", color: TASK_SOURCE_NEUTRAL },
};

// ---------------------------------------------------------------------------
// Workforce Risk → color/dot/label mapping (WorkforceRiskBadge)
// Same visual pattern as RiskBadge — dot + label pill, different domain
// Per design-tokens.md §12: stabil=positive, takip_gerekli=warning, kritik_acik=danger
// ---------------------------------------------------------------------------

import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import { IS_GUCU_RISK_LABELS } from "@/types/batch4";

export const WORKFORCE_RISK_CONFIG: Record<IsGucuRiskSeviyesi, { label: string; color: string; dot: string }> = {
  stabil: { label: IS_GUCU_RISK_LABELS.stabil, color: BADGE_COLOR.positive, dot: BADGE_DOT_COLOR.positive },
  takip_gerekli: { label: IS_GUCU_RISK_LABELS.takip_gerekli, color: BADGE_COLOR.warning, dot: BADGE_DOT_COLOR.warning },
  kritik_acik: { label: IS_GUCU_RISK_LABELS.kritik_acik, color: BADGE_COLOR.danger, dot: BADGE_DOT_COLOR.danger },
};

// ---------------------------------------------------------------------------
// Margin Band → color/dot/label mapping (MarginBandBadge)
// Estimated commercial-quality band — management visibility only
// saglikli=positive, dar=warning, riskli=danger
// ---------------------------------------------------------------------------

import type { MarjBandi } from "@/types/ticari-kalite";
import { MARJ_BANDI_LABELS } from "@/types/ticari-kalite";

export const MARGIN_BAND_CONFIG: Record<MarjBandi, { label: string; color: string; dot: string }> = {
  saglikli: { label: MARJ_BANDI_LABELS.saglikli, color: BADGE_COLOR.positive, dot: BADGE_DOT_COLOR.positive },
  dar: { label: MARJ_BANDI_LABELS.dar, color: BADGE_COLOR.warning, dot: BADGE_DOT_COLOR.warning },
  riskli: { label: MARJ_BANDI_LABELS.riskli, color: BADGE_COLOR.danger, dot: BADGE_DOT_COLOR.danger },
};
