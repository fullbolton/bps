import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_CAPTION,
  TYPE_KPI_VALUE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "@/styles/tokens";

interface FinancialSummaryCardProps {
  label: string;
  value: string;
  /** Optional secondary line below the value */
  subLabel?: string;
}

/**
 * Management-visibility metric card for Finansal Özet.
 * Distinct from KPIStatCard: no href, no onClick, no trend.
 * Non-interactive by design — this is a read-only management summary.
 */
export default function FinancialSummaryCard({
  label,
  value,
  subLabel,
}: FinancialSummaryCardProps) {
  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4 flex flex-col gap-1.5`}>
      <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{label}</span>
      <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{value}</span>
      {subLabel && (
        <span className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{subLabel}</span>
      )}
    </div>
  );
}
