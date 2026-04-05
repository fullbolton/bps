import type { StatusType } from "@/types/ui";
import { clsx } from "clsx";
import {
  BADGE_BASE,
  BADGE_SIZE,
  STATUS_COLOR_MAP,
  STATUS_DEFAULT_COLOR,
  STATUS_LABELS,
} from "@/styles/badge";

interface StatusBadgeProps {
  status: StatusType;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_COLOR_MAP[status] ?? STATUS_DEFAULT_COLOR;

  return (
    <span
      className={clsx(
        BADGE_BASE,
        color,
        BADGE_SIZE[size]
      )}
    >
      {label}
    </span>
  );
}
