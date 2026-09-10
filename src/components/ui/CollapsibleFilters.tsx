"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

/** Compact on mobile; the same controls remain visible on desktop. */
export default function CollapsibleFilters({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return (
    <div className="min-w-0 flex-1">
      <button type="button" aria-expanded={expanded} aria-controls={panelId}
        onClick={() => setExpanded(value => !value)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:hidden">
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Filtreler{activeCount > 0 ? ` (${activeCount} etkin)` : ""}</span>
        <ChevronDown size={16} aria-hidden="true" className={`ml-auto transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <div id={panelId} className={`${expanded ? "block" : "hidden"} pt-3 sm:block sm:pt-0`}>
        {children}
      </div>
    </div>
  );
}
