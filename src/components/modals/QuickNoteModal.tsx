"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui";
import { NOT_ETIKET_LABELS } from "@/mocks/notlar";
import type { NotEtiketi } from "@/mocks/notlar";

interface QuickNoteModalProps {
  open: boolean;
  onClose: () => void;
  /** Contextual: shown in modal title when opened from a specific firma */
  firmaAdi?: string;
  /** Pre-filled note text, e.g. from AI suggestion flow */
  defaultIcerik?: string;
  /** Pre-selected tag for edit mode */
  defaultEtiket?: NotEtiketi | "";
  /** If true, modal is in edit mode */
  editMode?: boolean;
  /** Called on submit with note content + tag */
  onSubmit?: (data: { icerik: string; etiket: NotEtiketi | "" }) => void;
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
  const [etiket, setEtiket] = useState<NotEtiketi | "">(defaultEtiket ?? "");

  useEffect(() => {
    if (open) {
      setIcerik(defaultIcerik ?? "");
      setEtiket(defaultEtiket ?? "");
    }
  }, [open, defaultIcerik, defaultEtiket]);

  function handleSubmit() {
    if (!icerik.trim()) return;
    if (onSubmit) {
      onSubmit({ icerik: icerik.trim(), etiket });
    } else {
      console.log("[demo] Not eklendi:", { firma: firmaAdi, icerik: icerik.trim(), etiket });
    }
    resetAndClose();
  }

  function resetAndClose() {
    setIcerik("");
    setEtiket("");
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
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!icerik.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {editMode ? "Güncelle" : "Kaydet"}
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
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Etiket
          </label>
          <select
            value={etiket}
            onChange={(e) => setEtiket(e.target.value as NotEtiketi | "")}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Etiket seçin (opsiyonel)</option>
            {(Object.entries(NOT_ETIKET_LABELS) as [NotEtiketi, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>
    </ModalShell>
  );
}
