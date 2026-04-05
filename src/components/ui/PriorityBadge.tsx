import type { OncelikSeviyesi } from "@/types/ui";
import { clsx } from "clsx";
import {
  BADGE_BASE,
  BADGE_SIZE,
  PRIORITY_CONFIG,
} from "@/styles/badge";

interface PriorityBadgeProps {
  priority: OncelikSeviyesi;
  size?: "sm" | "md";
}

export default function PriorityBadge({ priority, size = "sm" }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className={clsx(
        BADGE_BASE,
        config.color,
        BADGE_SIZE[size]
      )}
    >
      {config.label}
    </span>
  );
}
