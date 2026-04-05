"use client";

import type { FilterConfig, FilterValues } from "@/types/ui";
import { X } from "lucide-react";
import {
  TYPE_BODY,
  BORDER_DEFAULT,
  RADIUS_SM,
  SURFACE_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
} from "@/styles/tokens";

const FILTER_INPUT = `${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} px-3 py-2 ${SURFACE_PRIMARY} ${TEXT_BODY} focus:outline-none focus:ring-2 focus:ring-blue-500`;

interface FilterBarProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export default function FilterBar({ filters, values, onChange }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== "");

  function handleChange(key: string, value: string) {
    onChange({ ...values, [key]: value });
  }

  function handleClearAll() {
    const cleared: FilterValues = {};
    filters.forEach((f) => {
      cleared[f.key] = "";
    });
    onChange(cleared);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {filters.map((filter) => {
        if (filter.type === "select") {
          return (
            <select
              key={filter.key}
              value={values[filter.key] ?? ""}
              onChange={(e) => handleChange(filter.key, e.target.value)}
              className={FILTER_INPUT}
            >
              <option value="">{filter.placeholder ?? filter.label}</option>
              {filter.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        }

        if (filter.type === "date") {
          return (
            <input
              key={filter.key}
              type="date"
              value={values[filter.key] ?? ""}
              onChange={(e) => handleChange(filter.key, e.target.value)}
              className={FILTER_INPUT}
            />
          );
        }

        return null;
      })}

      {hasActiveFilters && (
        <button
          onClick={handleClearAll}
          className={`flex items-center gap-1 ${TYPE_BODY} ${TEXT_SECONDARY} hover:text-slate-700 transition-colors`}
        >
          <X size={14} />
          <span>Temizle</span>
        </button>
      )}
    </div>
  );
}
