/**
 * BPS — AsyncSection: 3-way render branch for async data sections.
 *
 *   loading  → existing skeleton/spinner (default: "Yükleniyor…")
 *   error    → visible failure signal ("Veri yüklenemedi" + retry)
 *   empty    → caller-provided empty copy (preserves verbatim text)
 *   content  → children
 *
 * Replaces the silent `catch(() => [])` / `error ? [] : ...` pattern that
 * previously rendered reader failures as healthy-empty on Dashboard /
 * Reports. Pure presentation: no fetching, no business logic. Caller is
 * responsible for tracking `isLoading` / `hasError` / `isEmpty` flags
 * from its data layer (Promise.all responses or service-reader catches).
 */

"use client";

import type { ReactNode } from "react";
import { TYPE_BODY, TYPE_CAPTION, TEXT_MUTED } from "@/styles/tokens";

interface AsyncSectionProps {
  isLoading: boolean;
  hasError: boolean;
  /**
   * When true, renders the empty copy instead of children. Leave
   * undefined when the child component (e.g., DataTable) handles its
   * own empty state internally.
   */
  isEmpty?: boolean;
  /** Empty-state copy. Required when `isEmpty` is provided. */
  emptyText?: string;
  /** Optional retry callback. When provided, renders a "Tekrar dene"
   *  link in the error branch. Skip if wiring requires structural
   *  refetch changes. */
  onRetry?: () => void;
  children: ReactNode;
}

const CENTER_LINE = `${TYPE_BODY} ${TEXT_MUTED} text-center py-4`;

export default function AsyncSection({
  isLoading,
  hasError,
  isEmpty,
  emptyText,
  onRetry,
  children,
}: AsyncSectionProps) {
  if (isLoading) {
    return <p className={CENTER_LINE}>Yükleniyor…</p>;
  }
  if (hasError) {
    return (
      <div className="text-center py-4 space-y-1" role="status" aria-live="polite">
        <p className={`${TYPE_BODY} text-amber-700 font-medium`}>Veri yüklenemedi</p>
        <p className={`${TYPE_CAPTION} ${TEXT_MUTED}`}>
          Bu bölüm geçici olarak getirilemedi. Tekrar deneyin.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={`${TYPE_CAPTION} text-blue-600 hover:underline mt-1`}
          >
            Tekrar dene
          </button>
        )}
      </div>
    );
  }
  if (isEmpty && emptyText) {
    return <p className={CENTER_LINE}>{emptyText}</p>;
  }
  return <>{children}</>;
}
