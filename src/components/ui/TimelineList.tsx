"use client";

import { useState } from "react";
import ActivityFeed from "./ActivityFeed";
import type { ActivityEvent } from "./ActivityFeed";
import {
  TYPE_CAPTION,
  TEXT_PRIMARY,
  TEXT_INVERSE,
  RADIUS_FULL,
} from "@/styles/tokens";

const EVENT_TYPE_LABELS: Record<string, string> = {
  firma: "Firma",
  sozlesme: "Sözleşme",
  randevu: "Randevu",
  gorev: "Görev",
  evrak: "Evrak",
  talep: "Talep",
  not: "Not",
};

const CHIP_BASE = `px-3 py-1 ${TYPE_CAPTION} font-medium ${RADIUS_FULL}`;
const CHIP_ACTIVE = `bg-slate-900 ${TEXT_INVERSE}`;
const CHIP_INACTIVE = "bg-slate-100 text-slate-600 hover:bg-slate-200";

interface TimelineListProps {
  events: ActivityEvent[];
}

/**
 * TimelineList composes ActivityFeed with a basic event-type chip filter.
 * Used in Firma Detay > Zaman Çizgisi tab.
 * Per COMPONENT_SYSTEM §6: timeline and activity feed share similar logic.
 * TimelineList wraps ActivityFeed — it does not duplicate it.
 */
export default function TimelineList({ events }: TimelineListProps) {
  const [filter, setFilter] = useState<string>("all");

  const eventTypes = Array.from(new Set(events.map((e) => e.type)));

  const filtered =
    filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`${CHIP_BASE} ${filter === "all" ? CHIP_ACTIVE : CHIP_INACTIVE}`}
        >
          Tümü
        </button>
        {eventTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`${CHIP_BASE} ${filter === type ? CHIP_ACTIVE : CHIP_INACTIVE}`}
          >
            {EVENT_TYPE_LABELS[type] ?? type}
          </button>
        ))}
      </div>
      <ActivityFeed events={filtered} />
    </div>
  );
}
