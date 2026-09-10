"use client";

import { useRef, useState } from "react";
import ModalShell from "./ModalShell";

/** Mount per selected action; the caller keeps server authorization authoritative. */
export default function ConfirmActionDialog({ title, recordName, description, confirmLabel, destructive = false, onConfirm, onClose }: {
  title: string;
  recordName: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => { if (!busy.current) onClose(); };
  async function confirm() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı. Tekrar deneyin.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return <ModalShell open title={title} onClose={close} footer={<>
    <button type="button" data-dialog-initial-focus disabled={pending} onClick={close} className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium disabled:opacity-40">Vazgeç</button>
    <button type="button" disabled={pending} onClick={() => void confirm()} className={`min-h-11 rounded-lg px-4 text-sm font-medium text-white disabled:opacity-40 ${destructive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}>{pending ? "İşlem sürüyor…" : confirmLabel}</button>
  </>}>
    <p className="mb-3 break-words rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-900">{recordName}</p>
    <p className="text-sm leading-6 text-slate-600">{description}</p>
    {pending && <p role="status" className="mt-4 text-sm text-blue-700">İşlem sürüyor, lütfen bekleyin.</p>}
    {error && <p role="alert" className="mt-4 break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </ModalShell>;
}
