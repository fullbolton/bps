import type { RiskSeviyesi } from "@/types/ui";
import { clsx } from "clsx";
import {
  BADGE_BASE,
  BADGE_SIZE,
  BADGE_DOT,
  BADGE_DOT_GAP,
  RISK_CONFIG,
} from "@/styles/badge";

interface RiskBadgeProps {
  risk: RiskSeviyesi;
  size?: "sm" | "md";
}

export default function RiskBadge({ risk, size = "sm" }: RiskBadgeProps) {
  const config = RISK_CONFIG[risk];

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
