"use client";

export type PickerStatus = "loading" | "error" | "ready";

/** Describes directory availability without treating a failed read as empty. */
export default function PickerFeedback({id, status, count, name, emptyText, onRetry}: {
  id: string; status: PickerStatus; count: number; name: string; emptyText: string; onRetry?: () => void;
}) {
  if (status === "ready" && count > 0) return null;
  return <div id={id} className="mt-2 space-y-1 text-sm text-slate-600">
    <p role="status">{status === "loading" ? `${name} yükleniyor…` : status === "error" ? `${name} yüklenemedi. Tekrar deneyin.` : emptyText}</p>
    {status === "error" && onRetry && <button type="button" onClick={onRetry}
      className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-blue-700 hover:bg-blue-50">
      {name === "Firma listesi" ? "Firmaları tekrar yükle" : "Kişileri tekrar yükle"}
    </button>}
  </div>;
}
