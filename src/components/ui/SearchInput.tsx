"use client";

import { useState, useEffect, useRef, useImperativeHandle, type Ref } from "react";
import { Search, X } from "lucide-react";
import {
  TYPE_BODY,
  BORDER_DEFAULT,
  RADIUS_SM,
  SURFACE_PRIMARY,
  TEXT_MUTED,
} from "@/styles/tokens";

export interface SearchInputHandle { clear: () => void; }

interface SearchInputProps {
  ref?: Ref<SearchInputHandle>;
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  maxLength?: number;
}

export default function SearchInput({
  ref,
  placeholder = "Ara...",
  value: externalValue,
  onChange,
  debounceMs = 300,
  maxLength,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(externalValue ?? "");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    if (externalValue !== undefined) {
      if (timer.current) clearTimeout(timer.current);
      setInternalValue(externalValue);
    }
  }, [externalValue]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleInput(value: string) {
    setInternalValue(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; callback.current(value); }, debounceMs);
  }
  function handleClear() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setInternalValue("");
    callback.current("");
    inputRef.current?.focus();
  }
  useImperativeHandle(ref, () => ({ clear: handleClear }));

  return (
    <div className="relative">
      <Search
        size={16}
        className={`absolute left-3 top-1/2 -translate-y-1/2 ${TEXT_MUTED}`}
      />
      <input
        ref={inputRef}
        aria-label={placeholder}
        type="text"
        maxLength={maxLength}
        value={internalValue}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
            callback.current(internalValue);
          } else if (event.key === "Escape" && internalValue) {
            event.preventDefault();
            event.stopPropagation();
            handleClear();
          }
        }}
        placeholder={placeholder}
        className={`w-full min-h-11 pl-9 pr-12 py-2 ${TYPE_BODY} border ${BORDER_DEFAULT} ${RADIUS_SM} ${SURFACE_PRIMARY} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
      />
      {internalValue && (
        <button
          type="button"
          aria-label="Aramayı temizle"
          title="Aramayı temizle (Esc)"
          onClick={handleClear}
          className={`absolute right-0 top-1/2 flex h-11 w-11 items-center justify-center -translate-y-1/2 ${TEXT_MUTED} hover:text-slate-600`}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
