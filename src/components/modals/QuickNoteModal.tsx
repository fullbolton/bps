"use client";

import { useState, useEffect, useId, useRef } from "react";
import { ModalShell } from "@/components/ui";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { NOTE_TAG_LABELS } from "@/lib/note-tags";
import type { NoteTagKey } from "@/lib/note-tags";

interface QuickNoteModalProps {
  open: boolean;
  onClose: () => void;
  firmaAdi?: string;
  defaultIcerik?: string;
  defaultEtiket?: NoteTagKey | "";
  editMode?: boolean;
  onSubmit: (data: { icerik: string; etiket: NoteTagKey | "" }) => Promise<void> | void;
}

/** Mount a fresh draft on each opening. Parent keys by authorization context/record. */
export default function QuickNoteModal(props: QuickNoteModalProps) {
  return props.open ? <NoteDraft {...props} /> : null;
}

function NoteDraft({onClose, firmaAdi, defaultIcerik = "", defaultEtiket = "", editMode = false, onSubmit}: QuickNoteModalProps) {
  const formId = useId();
  const [icerik, setIcerik] = useState(defaultIcerik);
  const [etiket, setEtiket] = useState<NoteTagKey | "">(defaultEtiket);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function handleSubmit() {
    if (!icerik.trim() || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit({ icerik: icerik.trim(), etiket });
      if (mounted.current) onClose();
    } catch (err) {
      if (mounted.current) setSubmitError(err instanceof Error ? err.message : "Not kaydedilemedi. Tekrar deneyin.");
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const hasChanges = editMode
    ? icerik !== defaultIcerik || etiket !== defaultEtiket
    : icerik !== "" || etiket !== "";
  function requestClose() {
    if (submitting.current) return;
    if (hasChanges) setDiscardOpen(true);
    else onClose();
  }

  return <>
    <ModalShell open onClose={requestClose} closeDisabled={saving}
      title={editMode ? "Notu Düzenle" : firmaAdi ? `Not Ekle — ${firmaAdi}` : "Not Ekle"}
      footer={<>
        <button type="button" onClick={requestClose} disabled={saving}
          className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">İptal</button>
        <button type="submit" form={formId} disabled={!icerik.trim() || saving}
          className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? "Kaydediliyor…" : editMode ? "Güncelle" : "Kaydet"}
        </button>
      </>}
    >
      <form id={formId} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} aria-busy={saving}>
        <fieldset disabled={saving} className="space-y-4">
          <div>
            <label htmlFor={`${formId}-content`} className="block text-sm font-medium text-slate-700 mb-1">Not <span className="text-red-500">*</span></label>
            <textarea id={`${formId}-content`} data-dialog-initial-focus required value={icerik} onChange={e => setIcerik(e.target.value)} placeholder="Notunuzu yazın..." rows={5}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-slate-50 disabled:text-slate-400" />
          </div>
          <div>
            <label htmlFor={`${formId}-tag`} className="block text-sm font-medium text-slate-700 mb-1">Etiket</label>
            <select id={`${formId}-tag`} value={etiket} onChange={e => setEtiket(e.target.value as NoteTagKey | "")}
              className="min-h-11 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400">
              <option value="">Etiket seçin (opsiyonel)</option>
              {(Object.entries(NOTE_TAG_LABELS) as [NoteTagKey, string][]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </fieldset>
        {saving && <p role="status" className="mt-4 text-sm text-blue-700">Not kaydediliyor, lütfen bekleyin…</p>}
        {submitError && <p className="mt-4 break-words text-sm text-red-600" role="alert" aria-live="polite">{submitError}</p>}
      </form>
    </ModalShell>
    {discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler" recordName={editMode ? "Not düzenlemesi" : "Yeni not"}
      description="Bu nottaki kaydedilmemiş değişiklikler bırakılacak." confirmLabel="Değişiklikleri bırak" destructive
      onClose={() => setDiscardOpen(false)} onConfirm={async () => { if (!submitting.current) onClose(); }} />}
  </>;
}
