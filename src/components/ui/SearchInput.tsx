"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import {
  TYPE_BODY,
  BORDER_DEFAULT,
  RADIUS_SM,
  SURFACE_PRIMARY,
  TEXT_MUTED,
} from "@/styles/tokens";

interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
}

export default function SearchInput({
  placeholder = "Ara...",
  value: externalValue,
  onChange,
  debounceMs = 300,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(externalValue ?? "");

  useEffect(() => {
    if (externalValue !== undefined) {
      setInternalValue(externalValue);
    }
  }, [externalValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(internalValue);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [internalValue, debounceMs, onChange]);

  const handleClear = useCallback(() => {
    setInternalValue("");
  }, []);

  return (
    <div className="relative">
      <Search
        size={16}
        className={`absolute left-3 top-1/2 -translate-y-1/2 ${TEXT_MUTED}`}
      />
      <input
        type="text"
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-8 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} ${SURFACE_PRIMARY} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
      />
      {internalValue && (
        <button
          onClick={handleClear}
          className={`absolute right-2 top-1/2 -translate-y-1/2 ${TEXT_MUTED} hover:text-slate-600`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
