"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui";
import { NOTE_TAG_LABELS } from "@/lib/note-tags";
import type { NoteTagKey } from "@/lib/note-tags";

interface QuickNoteModalProps {
  open: boolean;
  onClose: () => void;
  /** Contextual: shown in modal title when opened from a specific firma */
  firmaAdi?: string;
  /** Pre-filled note text, e.g. from AI suggestion flow */
  defaultIcerik?: string;
  /** Pre-selected tag for edit mode */
  defaultEtiket?: NoteTagKey | "";
  /** If true, modal is in edit mode */
  editMode?: boolean;
  /**
   * Called on submit with note content + tag. May return a Promise —
   * the modal awaits it and only closes on resolve, so the parent can
   * throw a Turkish-localized service-layer error and the modal
   * surfaces it inline instead of silently closing on failure.
   */
  onSubmit?: (data: { icerik: string; etiket: NoteTagKey | "" }) => Promise<void> | void;
}

/**
 * QuickNoteModal is the single note creation/edit surface.
 * It opens from Firmalar Liste row action, Firma Detay header,
 * note suggestion flow, and Notlar tab "Yeni Not" button.
 */
export default function QuickNoteModal({
  open,
  onClose,
  firmaAdi,
  defaultIcerik,
  defaultEtiket,
  editMode = false,
  onSubmit,
}: QuickNoteModalProps) {
  const [icerik, setIcerik] = useState(defaultIcerik ?? "");
  const [etiket, setEtiket] = useState<NoteTagKey | "">(defaultEtiket ?? "");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIcerik(defaultIcerik ?? "");
      setEtiket(defaultEtiket ?? "");
      setSubmitError(null);
      setSaving(false);
    }
  }, [open, defaultIcerik, defaultEtiket]);

  async function handleSubmit() {
    if (!icerik.trim() || saving) return;
    setSaving(true);
    setSubmitError(null);
    try {
      if (onSubmit) {
        await onSubmit({ icerik: icerik.trim(), etiket });
      } else {
        console.log("[demo] Not eklendi:", { firma: firmaAdi, icerik: icerik.trim(), etiket });
      }
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Beklenmeyen bir hata oluştu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setIcerik("");
    setEtiket("");
    setSubmitError(null);
    setSaving(false);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title={editMode ? "Notu Düzenle" : firmaAdi ? `Not Ekle — ${firmaAdi}` : "Not Ekle"}
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!icerik.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor…" : editMode ? "Güncelle" : "Kaydet"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Not <span className="text-red-500">*</span>
          </label>
          <textarea
            value={icerik}
            onChange={(e) => setIcerik(e.target.value)}
            placeholder="Notunuzu yazın..."
            rows={4}
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-slate-50 disabled:text-slate-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Etiket
          </label>
          <select
            value={etiket}
            onChange={(e) => setEtiket(e.target.value as NoteTagKey | "")}
            disabled={saving}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">Etiket seçin (opsiyonel)</option>
            {(Object.entries(NOTE_TAG_LABELS) as [NoteTagKey, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
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
