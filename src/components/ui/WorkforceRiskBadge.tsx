import type { IsGucuRiskSeviyesi } from "@/types/batch4";
import { clsx } from "clsx";
import {
  BADGE_BASE,
  BADGE_SIZE,
  BADGE_DOT,
  BADGE_DOT_GAP,
  WORKFORCE_RISK_CONFIG,
} from "@/styles/badge";

interface WorkforceRiskBadgeProps {
  risk: IsGucuRiskSeviyesi;
  size?: "sm" | "md";
}

export default function WorkforceRiskBadge({ risk, size = "sm" }: WorkforceRiskBadgeProps) {
  const config = WORKFORCE_RISK_CONFIG[risk];
  return (
    <span
      className={clsx(
        BADGE_BASE,
        BADGE_DOT_GAP,
        config.color,
        BADGE_SIZE[size]
      )}
    >
      <span className={clsx(BADGE_DOT, config.dot)} />
      {config.label}
    </span>
  );
}
