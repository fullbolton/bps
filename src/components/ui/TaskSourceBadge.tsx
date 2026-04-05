import { PenLine, CalendarCheck, FileText } from "lucide-react";
import { clsx } from "clsx";
import type { GorevKaynagi } from "@/mocks/gorevler";
import {
  BADGE_BASE,
  BADGE_SIZE,
  TASK_SOURCE_CONFIG,
} from "@/styles/badge";
import type { ReactNode } from "react";

/** Icons stay in the component — React elements, not stored in badge.ts */
const SOURCE_ICONS: Record<GorevKaynagi, ReactNode> = {
  manuel: <PenLine size={12} />,
  randevu: <CalendarCheck size={12} />,
  sozlesme: <FileText size={12} />,
};

interface TaskSourceBadgeProps {
  source: GorevKaynagi;
}

export default function TaskSourceBadge({ source }: TaskSourceBadgeProps) {
  const config = TASK_SOURCE_CONFIG[source];

  return (
    <span
      className={clsx(
        BADGE_BASE,
        "gap-1",
        config.color,
        BADGE_SIZE.sm
      )}
    >
      {SOURCE_ICONS[source]}
      {config.label}
    </span>
  );
}
