"use client";

import { clsx } from "clsx";
import {
  TYPE_LABEL,
  TEXT_INVERSE,
  RADIUS_FULL,
} from "@/styles/tokens";

export interface ReportOption {
  key: string;
  label: string;
}

interface ReportSwitcherProps {
  reports: ReportOption[];
  activeKey: string;
  onSwitch: (key: string) => void;
}

const CHIP_BASE = `px-3 py-1 ${TYPE_LABEL} ${RADIUS_FULL} border transition-colors`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE} border-slate-900`;
const CHIP_INACTIVE = "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";

/**
 * Lightweight chip-row for switching between fixed reports.
 * Receives only the reports the current role is allowed to see.
 * No role logic inside — filtering happens at page level.
 */
export default function ReportSwitcher({
  reports,
  activeKey,
  onSwitch,
}: ReportSwitcherProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {reports.map((r) => (
        <button
          key={r.key}
          onClick={() => onSwitch(r.key)}
          className={clsx(
            CHIP_BASE,
            r.key === activeKey ? CHIP_ACTIVE : CHIP_INACTIVE
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
