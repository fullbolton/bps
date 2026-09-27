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

import { useEffect, useState, useRef, useId } from "react";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { ModalShell } from "@/components/ui";

interface AssignOwnerModalProps {
  open: boolean;
  onClose: () => void;
  talepRef?: string;
  talepId?: string;
  initialSorumlu?: string;
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
  initialSorumlu = "",
  onSubmit,
}: AssignOwnerModalProps) {
  const submitting = useRef(false);
  const formId = useId();
  const [discardOpen, setDiscardOpen] = useState(false);
  const [sorumlu, setSorumlu] = useState(initialSorumlu);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form state when modal opens/closes
  useEffect(() => {
    if (!open) return;
    setSorumlu(initialSorumlu);
    submitting.current = false;
    setDiscardOpen(false);
    setSaving(false);
    setSubmitError(null);
  }, [open, talepId, initialSorumlu]);

  const canSubmit = !!talepId && !!sorumlu.trim() && sorumlu.trim() !== initialSorumlu.trim();

  async function handleSubmit() {
    if (!canSubmit || !talepId || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ talepId, sorumlu: sorumlu.trim() });
      submitting.current = false;
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function requestClose() {
    if (submitting.current) return;
    if (sorumlu !== initialSorumlu) setDiscardOpen(true);
    else resetAndClose();
  }

  function resetAndClose() {
    if (submitting.current) return;
    setDiscardOpen(false);
    setSorumlu("");
    setSubmitError(null);
    onClose();
  }

  return (
    <>
    <ModalShell
      open={open}
      onClose={requestClose}
      closeDisabled={saving}
      title="Sorumlu Ata"
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!canSubmit || saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : initialSorumlu.trim() ? "Güncelle" : "Ata"}
          </button>
        </>
      }
    >
      <form id={formId} className="space-y-4" aria-busy={saving} onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }}>
        {saving && <p role="status" className="text-sm text-slate-600">Sorumlu kaydediliyor, lütfen bekleyin…</p>}
        {talepRef && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-700">Talep: {talepRef}</p>
          </div>
        )}
        <div>
          <label htmlFor={`${formId}-owner`} className="block text-sm font-medium text-slate-700 mb-1">
            Sorumlu Kişi <span className="text-red-500">*</span>
          </label>
          <input
            id={`${formId}-owner`}
            data-dialog-initial-focus
            required
            type="text"
            value={sorumlu}
            onChange={(e) => setSorumlu(e.target.value)}
            placeholder="Kişi adı"
            disabled={saving}
            className="min-h-11 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
      </form>
    </ModalShell>
    {open && discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler"
      recordName={talepRef || "Talep sorumlusu"}
      description="Sorumlu alanındaki kaydedilmemiş değişiklik bırakılacak."
      confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardOpen(false)}
      onConfirm={async () => { resetAndClose(); }} />}
    </>
  );
}
