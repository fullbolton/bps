"use client";

import type { FilterConfig, FilterValues } from "@/types/ui";
import { useId, useRef } from "react";
import { X } from "lucide-react";
import {
  TYPE_BODY,
  BORDER_DEFAULT,
  RADIUS_SM,
  SURFACE_PRIMARY,
  TEXT_BODY,
  TEXT_SECONDARY,
} from "@/styles/tokens";

const FILTER_INPUT = `${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} min-h-11 w-full max-w-full px-3 py-2 ${SURFACE_PRIMARY} ${TEXT_BODY} focus:outline-none focus:ring-2 focus:ring-blue-500`;

interface FilterBarProps {
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
}

export default function FilterBar({ filters, values, onChange }: FilterBarProps) {
  const groupId = useId();
  const groupRef = useRef<HTMLDivElement>(null);
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
    groupRef.current?.querySelector<HTMLSelectElement | HTMLInputElement>("select, input")?.focus();
  }

  return (
    <div ref={groupRef} className="flex min-w-0 flex-wrap items-end gap-3">
      {filters.map((filter, index) => {
        const inputId = `${groupId}-${index}`;
        const missingChoice = filter.type === "select" && !!values[filter.key] && !filter.options?.some(option => option.value === values[filter.key]);
        if (filter.type === "select") {
          return (
            <div key={filter.key} className="min-w-0 max-w-full flex-[1_1_160px]">
              <label htmlFor={inputId} className={`mb-1 block text-xs ${TEXT_SECONDARY}`}>{filter.label}</label>
              <select
                id={inputId}
                aria-describedby={missingChoice ? `${inputId}-hint` : undefined}
                value={values[filter.key] ?? ""}
                onChange={(e) => handleChange(filter.key, e.target.value)}
                className={FILTER_INPUT}
              >
                <option value="">{filter.placeholder ?? filter.label}</option>
                {missingChoice && <option value={values[filter.key]} disabled>Kayıtlı seçim (listede yok)</option>}
                {filter.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {missingChoice && <p id={`${inputId}-hint`} className="mt-1 max-w-56 text-xs text-amber-800">Kayıtlı seçim mevcut seçeneklerde yok. Seçimi değiştirin veya filtreleri temizleyin.</p>}
            </div>
          );
        }

        if (filter.type === "date") {
          return (
            <div key={filter.key} className="min-w-0 max-w-full flex-[1_1_160px]">
              <label htmlFor={inputId} className={`mb-1 block text-xs ${TEXT_SECONDARY}`}>{filter.label}</label>
              <input
                id={inputId}
                type="date"
                value={values[filter.key] ?? ""}
                onChange={(e) => handleChange(filter.key, e.target.value)}
                className={FILTER_INPUT}
              />
            </div>
          );
        }

        return null;
      })}

      {hasActiveFilters && (
        <button
          type="button"
          onClick={handleClearAll}
          className={`flex min-h-11 items-center gap-1 px-2 ${TYPE_BODY} ${TEXT_SECONDARY} hover:text-slate-700 transition-colors`}
        >
          <X size={14} />
          <span>Filtreleri temizle</span>
        </button>
      )}
    </div>
  );
}
