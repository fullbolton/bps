"use client";

/**
 * DemandTrendChart — Firma-context single-series area chart for Açık Talep Hacmi.
 * Operational visibility for demand pressure over time. Not analytics. Not forecasting.
 */

import { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { StaffingDemandRow } from "@/types/database.types";
import { computeOpenCount } from "@/lib/services/staffing-demands";
import {
  SURFACE_PRIMARY,
  BORDER_DEFAULT,
  RADIUS_DEFAULT,
  RADIUS_SM,
  TYPE_CAPTION,
  TYPE_CARD_TITLE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  RADIUS_FULL,
} from "@/styles/tokens";

type TimeFilter = "gun" | "ay" | "yil" | "tumu";

const FILTER_OPTIONS: { key: TimeFilter; label: string }[] = [
  { key: "gun", label: "Gün" },
  { key: "ay", label: "Ay" },
  { key: "yil", label: "Yıl" },
  { key: "tumu", label: "Tümü" },
];

const TR_MONTHS_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const TR_MONTHS_FULL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function formatDateTR(dateStr: string, filter: TimeFilter): string {
  const d = new Date(dateStr);
  if (filter === "yil" || filter === "tumu") {
    return `${TR_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]}`;
}

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${TR_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

interface DemandTrendChartProps {
  talepler: StaffingDemandRow[];
}

export default function DemandTrendChart({ talepler }: DemandTrendChartProps) {
  const [filter, setFilter] = useState<TimeFilter>("ay");

  const chartData = useMemo(() => {
    if (talepler.length === 0) return [];

    // Sort demands by start_date
    const sorted = [...talepler].sort(
      (a, b) => new Date(a.start_date ?? "").getTime() - new Date(b.start_date ?? "").getTime()
    );

    // Build daily data points: each demand contributes its open count starting from its start_date
    const dateMap = new Map<string, number>();

    // Compute cumulative açık talep hacmi per date
    for (const t of sorted) {
      const date = t.start_date ?? "";
      const current = dateMap.get(date) ?? 0;
      dateMap.set(date, current + computeOpenCount(t));
    }

    // Convert to sorted array
    const allDates = [...dateMap.entries()]
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

    // Build cumulative running total
    let running = 0;
    const cumulative = allDates.map(([date, added]) => {
      running += added;
      return { date, value: running };
    });

    // Apply time filter
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    let cutoff: Date;

    switch (filter) {
      case "gun":
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case "ay":
        cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - 30);
        break;
      case "yil":
        cutoff = new Date(now);
        cutoff.setFullYear(cutoff.getFullYear() - 1);
        break;
      case "tumu":
      default:
        cutoff = new Date(0);
        break;
    }

    return cumulative.filter((d) => new Date(d.date).getTime() >= cutoff.getTime());
  }, [talepler, filter]);

  if (talepler.length === 0) return null;

  return (
    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_DEFAULT} p-4 mb-4`}>
      <div className="flex items-center justify-between mb-3">
        <h4 className={`${TYPE_CARD_TITLE} ${TEXT_PRIMARY}`}>Açık Talep Hacmi</h4>
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={`px-2.5 py-1 ${TYPE_CAPTION} ${RADIUS_FULL} transition-colors ${
                filter === opt.key
                  ? "bg-slate-900 text-white font-medium"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <p className={`${TYPE_CAPTION} ${TEXT_MUTED} text-center py-6`}>
          Seçili dönemde veri bulunmuyor.
        </p>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="demandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDateTR(v, filter)}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as { date: string; value: number };
                  return (
                    <div className={`${SURFACE_PRIMARY} border ${BORDER_DEFAULT} ${RADIUS_SM} px-3 py-2 shadow-sm`}>
                      <p className={`${TYPE_CAPTION} ${TEXT_SECONDARY}`}>{formatTooltipDate(item.date)}</p>
                      <p className={`${TYPE_CAPTION} font-medium ${TEXT_PRIMARY}`}>Açık Talep: {item.value}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#demandFill)"
                dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className={`${TYPE_CAPTION} ${TEXT_MUTED} mt-2`}>
        Firma bazlı kümülatif açık talep hacmi. Yönetim varsayımı.
      </p>
    </div>
  );
}
