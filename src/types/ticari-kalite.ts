/**
 * Types for Tahmini Ticari Kalite (Estimated Commercial Quality) visibility.
 * Management-visibility layer only. Not accounting truth. Not a pricing engine.
 *
 * MarjBandi represents an estimated margin band per position type,
 * derived from flat management assumptions — not from contract financials.
 */

export type MarjBandi = "saglikli" | "dar" | "riskli";

export const MARJ_BANDI_LABELS: Record<MarjBandi, string> = {
  saglikli: "Sağlıklı",
  dar: "Dar Marj",
  riskli: "Riskli",
};
