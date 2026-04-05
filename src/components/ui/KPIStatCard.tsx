import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  TYPE_BODY,
  TYPE_CAPTION,
  TYPE_KPI_VALUE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  SHADOW_HOVER,
} from "@/styles/tokens";

interface KPIStatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  /** Accepted for future use. Not populated in Batch 2. */
  trend?: { value: string; positive?: boolean };
  href?: string;
  onClick?: () => void;
}

export default function KPIStatCard({
  label,
  value,
  icon,
  trend,
  href,
  onClick,
}: KPIStatCardProps) {
  const isInteractive = !!(href || onClick);
  const Wrapper = href ? "a" : onClick ? "button" : "div";
  const interactiveProps = href ? { href } : onClick ? { onClick } : {};

  return (
    <Wrapper
      {...(interactiveProps as Record<string, unknown>)}
      className={clsx(
        `${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4 flex flex-col gap-2 text-left`,
        isInteractive && `cursor-pointer hover:border-slate-300 hover:${SHADOW_HOVER} transition-all`
      )}
    >
      <div className="flex items-center justify-between">
        <span className={`${TYPE_BODY} ${TEXT_SECONDARY}`}>{label}</span>
        {icon && <span className={TEXT_MUTED}>{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className={`${TYPE_KPI_VALUE} ${TEXT_PRIMARY}`}>{value}</span>
        {trend && (
          <span
            className={clsx(
              `${TYPE_CAPTION} font-medium mb-1`,
              trend.positive ? "text-green-600" : "text-red-600"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
    </Wrapper>
  );
}
