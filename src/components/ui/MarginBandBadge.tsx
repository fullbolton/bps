import type { MarjBandi } from "@/types/ticari-kalite";
import { clsx } from "clsx";
import {
  BADGE_BASE,
  BADGE_SIZE,
  BADGE_DOT,
  BADGE_DOT_GAP,
  MARGIN_BAND_CONFIG,
} from "@/styles/badge";

interface MarginBandBadgeProps {
  band: MarjBandi;
  size?: "sm" | "md";
}

export default function MarginBandBadge({ band, size = "sm" }: MarginBandBadgeProps) {
  const config = MARGIN_BAND_CONFIG[band];
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
