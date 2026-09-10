"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  /**
   * Assignable users (profiles). The picker replaced a free-text field: a
   * typed name cannot carry identity, so it could not back the "my tasks"
   * ownership rule.
   */
  kullanicilar?: { id: string; ad: string }[];
  /** Distinguishes "still loading" / "load failed" / "genuinely nobody" — an
   *  empty array alone cannot tell them apart, and showing "yüklenemedi"
   *  during a normal load is a lie. */
  kullanicilarDurum?: "loading" | "error" | "ready";
  allowAssignee?: boolean;
  /** Pre-selected kaynak when creating from a specific context */
  defaultKaynak?: TaskSourceType;
  defaultFirmaId?: string;
  defaultKaynakRef?: string;
  /** Pre-filled from AI suggestion flow */
  defaultBaslik?: string;
  defaultOncelik?: string;
  prefillNotice?: string;
  onSubmit?: (payload: {
    baslik: string;
    firmaId: string;
    kaynak: TaskSourceType;
    kaynakRef?: string;
    /** profiles.id of the selected user, or null. The service resolves the
     *  display name from it — the caller never supplies a name. */
    atananKisiId: string | null;
    termin: string;
    oncelik: string;
  }) => void | Promise<void>;
}

export default function NewTaskModal({
  open,
  onClose,
  firmalar,
  kullanicilar = [],
  kullanicilarDurum = "ready",
  allowAssignee = true,
  defaultKaynak,
  defaultFirmaId,
  defaultKaynakRef,
  defaultBaslik,
  defaultOncelik,
  prefillNotice,
  onSubmit,
}: NewTaskModalProps) {
  const formId = useId();
  const [baslik, setBaslik] = useState(defaultBaslik ?? "");
  const [firmaId, setFirmaId] = useState(defaultFirmaId ?? "");
  const [kaynak, setKaynak] = useState<TaskSourceType>(defaultKaynak ?? "manuel");
  // Holds profiles.id ("" = unassigned); the display name is derived from it.
  const [atananKisiId, setAtananKisiId] = useState("");
  const [termin, setTermin] = useState("");
  const [oncelik, setOncelik] = useState(defaultOncelik ?? "normal");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSourceLocked = Boolean(defaultKaynak && defaultKaynakRef);

  useEffect(() => {
    if (!open) return;
    setFirmaId(defaultFirmaId ?? "");
    setKaynak(defaultKaynak ?? "manuel");
    setAtananKisiId("");
    setTermin("");
    setSubmitError(null);
    setBaslik(defaultBaslik ?? "");
    setOncelik(defaultOncelik ?? "normal");
  }, [open, defaultFirmaId, defaultKaynak, defaultKaynakRef, defaultBaslik, defaultOncelik]);

  async function handleSubmit() {
    if (submitting.current || !baslik.trim() || !firmaId) return;
    submitting.current = true;
    const payload = {
      baslik: baslik.trim(),
      firmaId,
      kaynak,
      kaynakRef: defaultKaynakRef,
      atananKisiId: allowAssignee ? (atananKisiId || null) : null,
      termin,
      oncelik,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit?.(payload);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Görev oluşturulurken bir hata oluştu.",
      );
    } finally {
      setSaving(false);
      submitting.current = false;
    }
  }

  function resetAndClose() {
    if (submitting.current) return;
    setBaslik(defaultBaslik ?? "");
    setFirmaId(defaultFirmaId ?? "");
    setKaynak(defaultKaynak ?? "manuel");
    setOncelik(defaultOncelik ?? "normal");
    setAtananKisiId("");
    setTermin("");
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
            type="button"
            onClick={resetAndClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!baslik.trim() || !firmaId || saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Oluştur"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => { event.preventDefault(); void handleSubmit(); }} aria-describedby={`${formId}-help`}>
        <p id={`${formId}-help`} className="mb-4 text-sm text-slate-500">* işaretli alanlar zorunludur. Diğer bilgileri daha sonra tamamlayabilirsiniz.</p>
        {saving && <p role="status" className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">Kaydediliyor, lütfen bekleyin…</p>}
        <fieldset disabled={saving} aria-busy={saving} className="min-w-0 space-y-4">
          {prefillNotice && <p className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">{prefillNotice}</p>}
          {submitError && (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
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
              </p>
            </div>
          )}
          <div>
            <label htmlFor={`${formId}-baslik`} className="block text-sm font-medium text-slate-700 mb-1">
              Görev Başlığı <span className="text-red-500">*</span>
            </label>
            <input required data-dialog-initial-focus id={`${formId}-baslik`}
              type="text"
              value={baslik}
              onChange={(e) => setBaslik(e.target.value)}
              placeholder="Görev başlığını girin"
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-firmaId`} className="block text-sm font-medium text-slate-700 mb-1">
              Firma <span className="text-red-500">*</span>
            </label>
            <select required id={`${formId}-firmaId`}
              value={firmaId}
              onChange={(e) => setFirmaId(e.target.value)}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Firma seçin</option>
              {firmalar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-kaynak`} className="block text-sm font-medium text-slate-700 mb-1">
                Kaynak
              </label>
              <select id={`${formId}-kaynak`}
                value={kaynak}
                onChange={(e) => setKaynak(e.target.value as TaskSourceType)}
                disabled={isSourceLocked}
                className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {(Object.keys(TASK_SOURCE_LABELS) as TaskSourceType[]).map((k) => (
                  <option key={k} value={k}>
                    {TASK_SOURCE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-oncelik`} className="block text-sm font-medium text-slate-700 mb-1">
                Öncelik
              </label>
              <select id={`${formId}-oncelik`}
                value={oncelik}
                onChange={(e) => setOncelik(e.target.value)}
                className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${formId}-atananKisiId`} className="block text-sm font-medium text-slate-700 mb-1">
                  Atanan Kişi
                </label>
                <select id={`${formId}-atananKisiId`}
                  value={atananKisiId}
                  onChange={(e) => setAtananKisiId(e.target.value)}
                  disabled={kullanicilarDurum !== "ready" || kullanicilar.length === 0}
                  className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {kullanicilarDurum === "loading"
                      ? "Kullanıcılar yükleniyor…"
                      : kullanicilarDurum === "error"
                        ? "Kullanıcı listesi yüklenemedi"
                        : kullanicilar.length === 0
                          ? "Atanabilecek kullanıcı yok"
                          : "Atanmadı"}
                  </option>
                  {kullanicilar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${formId}-termin`} className="block text-sm font-medium text-slate-700 mb-1">
                  Termin
                </label>
                <input id={`${formId}-termin`}
                  type="date"
                  value={termin}
                  onChange={(e) => setTermin(e.target.value)}
                  className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor={`${formId}-termin`} className="block text-sm font-medium text-slate-700 mb-1">
                Termin
              </label>
              <input id={`${formId}-termin`}
                type="date"
                value={termin}
                onChange={(e) => setTermin(e.target.value)}
                className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </fieldset>
      </form>
    </ModalShell>
  );
}
