"use client";

import { useEffect, useState } from "react";
import { ModalShell } from "@/components/ui";
import { TASK_SOURCE_LABELS } from "@/lib/task-sources";
import type { TaskSourceType } from "@/lib/task-sources";

const ONCELIK_OPTIONS = [
  { value: "dusuk", label: "Düşük" },
  { value: "normal", label: "Normal" },
  { value: "yuksek", label: "Yüksek" },
  { value: "kritik", label: "Kritik" },
];

interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  allowAssignee?: boolean;
  /** Pre-selected kaynak when creating from a specific context */
  defaultKaynak?: TaskSourceType;
  defaultFirmaId?: string;
  defaultKaynakRef?: string;
  /** Pre-filled from AI suggestion flow */
  defaultBaslik?: string;
  defaultOncelik?: string;
  onSubmit?: (payload: {
    baslik: string;
    firmaId: string;
    kaynak: TaskSourceType;
    kaynakRef?: string;
    atananKisi: string;
    termin: string;
    oncelik: string;
  }) => void | Promise<void>;
}

export default function NewTaskModal({
  open,
  onClose,
  firmalar,
  allowAssignee = true,
  defaultKaynak,
  defaultFirmaId,
  defaultKaynakRef,
  defaultBaslik,
  defaultOncelik,
  onSubmit,
}: NewTaskModalProps) {
  const [baslik, setBaslik] = useState(defaultBaslik ?? "");
  const [firmaId, setFirmaId] = useState(defaultFirmaId ?? "");
  const [kaynak, setKaynak] = useState<TaskSourceType>(defaultKaynak ?? "manuel");
  const [atananKisi, setAtananKisi] = useState("");
  const [termin, setTermin] = useState("");
  const [oncelik, setOncelik] = useState(defaultOncelik ?? "normal");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSourceLocked = Boolean(defaultKaynak && defaultKaynakRef);

  useEffect(() => {
    if (!open) return;
    setFirmaId(defaultFirmaId ?? "");
    setKaynak(defaultKaynak ?? "manuel");
    setAtananKisi("");
    setTermin("");
    setSubmitError(null);
    if (defaultBaslik) setBaslik(defaultBaslik);
    if (defaultOncelik) setOncelik(defaultOncelik);
  }, [open, defaultFirmaId, defaultKaynak, defaultBaslik, defaultOncelik]);

  async function handleSubmit() {
    if (!baslik.trim() || !firmaId) return;
    const payload = {
      baslik: baslik.trim(),
      firmaId,
      kaynak,
      kaynakRef: defaultKaynakRef,
      atananKisi: allowAssignee ? atananKisi : "",
      termin,
      oncelik,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit?.(payload);
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Görev oluşturulurken bir hata oluştu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setBaslik(defaultBaslik ?? "");
    setFirmaId(defaultFirmaId ?? "");
    setKaynak(defaultKaynak ?? "manuel");
    setOncelik(defaultOncelik ?? "normal");
    setAtananKisi("");
    setTermin("");
    setOncelik("normal");
    setSubmitError(null);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Görev"
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
            disabled={!baslik.trim() || !firmaId || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs font-medium text-red-700">{submitError}</p>
          </div>
        )}
        {defaultKaynakRef && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-xs font-medium text-blue-700">
              Kaynak bağlamı korunuyor
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Bu görev {TASK_SOURCE_LABELS[kaynak]} kaynağı ile oluşturulacak.
              Kaynak referansı: {defaultKaynakRef}
            </p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Görev Başlığı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            placeholder="Görev başlığını girin"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Firma <span className="text-red-500">*</span>
          </label>
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Firma seçin</option>
            {firmalar.map((f) => (
              <option key={f.id} value={f.id}>
                {f.ad}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Kaynak
            </label>
            <select
              value={kaynak}
              onChange={(e) => setKaynak(e.target.value as TaskSourceType)}
              disabled={isSourceLocked}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(Object.keys(TASK_SOURCE_LABELS) as TaskSourceType[]).map((k) => (
                <option key={k} value={k}>
                  {TASK_SOURCE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Öncelik
            </label>
            <select
              value={oncelik}
              onChange={(e) => setOncelik(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ONCELIK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {allowAssignee ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Atanan Kişi
              </label>
              <input
                type="text"
                value={atananKisi}
                onChange={(e) => setAtananKisi(e.target.value)}
                placeholder="Kişi adı"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Termin
              </label>
              <input
                type="date"
                value={termin}
                onChange={(e) => setTermin(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Termin
            </label>
            <input
              type="date"
              value={termin}
              onChange={(e) => setTermin(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>
    </ModalShell>
  );
}
