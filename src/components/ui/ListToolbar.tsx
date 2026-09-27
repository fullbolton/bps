import type { ReactNode } from "react";

/** Shared layout only: each page owns its query, filter values and loading state. */
export default function ListToolbar({ label, search, children }: {
  label: string;
  search: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{label}</h2>
      <div className="min-w-0 space-y-4">
        <div className="w-full min-w-0">{search}</div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </section>
  );
}
