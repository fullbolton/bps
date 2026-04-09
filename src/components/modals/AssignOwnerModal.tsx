"use client";

/**
 * AssignOwnerModal — assign a responsible person to a staffing demand.
 *
 * Faz 3A change: the modal now accepts an async `onSubmit` callback
 * that the parent uses to call the staffing-demands service layer. The
 * modal awaits the resolve so service-layer errors bubble up and render
 * inline instead of silently closing on failure.
 *
 * Pattern follows NewContractModal (Faz 2).
 */

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";

interface AssignOwnerModalProps {
  open: boolean;
  onClose: () => void;
  talepRef?: string;
  talepId?: string;
  /**
   * Persistence callback. Awaited by the modal so the parent can throw
   * a Turkish-localized error and the modal will surface it inline
   * instead of closing on failure.
   */
  onSubmit: (payload: { talepId: string; sorumlu: string }) => Promise<void> | void;
}

export default function AssignOwnerModal({
  open,
  onClose,
  talepRef,
  talepId,
  onSubmit,
}: AssignOwnerModalProps) {
  const [sorumlu, setSorumlu] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!open) return;
    setSorumlu("");
    setSaving(false);
    setSubmitError(null);
  }, [open]);

  async function handleSubmit() {
    if (!sorumlu.trim() || !talepId || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ talepId, sorumlu: sorumlu.trim() });
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata olustu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    if (saving) return;
    setSorumlu("");
    setSubmitError(null);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Sorumlu Ata"
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!sorumlu.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Ata"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {talepRef && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-700">Talep: {talepRef}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sorumlu Kisi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={sorumlu}
            onChange={(e) => setSorumlu(e.target.value)}
            placeholder="Kisi adi"
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
      </div>
    </ModalShell>
  );
}
