"use client";

import { useEffect, useId, useRef, useState } from "react";
import TaskDueDateField from "./TaskDueDateField";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { ModalShell } from "@/components/ui";
import PickerFeedback, {type PickerStatus} from "@/components/ui/PickerFeedback";
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
  firmalarDurum?: PickerStatus;
  allowCompany?: boolean;
  onRetryFirmalar?: () => void;
  onRetryKullanicilar?: () => void;
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
  currentUserId?: string;
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
  firmalarDurum = "ready",
  allowCompany = true,
  onRetryFirmalar,
  onRetryKullanicilar,
  kullanicilar = [],
  kullanicilarDurum = "ready",
  allowAssignee = true,
  currentUserId,
  defaultKaynak,
  defaultFirmaId,
  defaultKaynakRef,
  defaultBaslik,
  defaultOncelik,
  prefillNotice,
  onSubmit,
}: NewTaskModalProps) {
  const formId = useId();
  const [discardOpen, setDiscardOpen] = useState(false);
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
    setDiscardOpen(false);
    if (!open) return;
    setFirmaId(defaultFirmaId ?? "");
    setKaynak(defaultKaynak ?? "manuel");
    setAtananKisiId("");
    setTermin("");
    setSubmitError(null);
    setBaslik(defaultBaslik ?? "");
    setOncelik(defaultOncelik ?? "normal");
  }, [open, defaultFirmaId, defaultKaynak, defaultKaynakRef, defaultBaslik, defaultOncelik]);

  const companyValid = allowCompany ? (!isSourceLocked && !firmaId) || firmalarDurum === "ready" && firmalar.some(f => f.id === firmaId)
    && (!isSourceLocked || (!!defaultFirmaId && firmaId === defaultFirmaId)) : !firmaId && !isSourceLocked;
  const assigneeValid = !allowAssignee || !atananKisiId || (kullanicilarDurum === "ready" && kullanicilar.some(k => k.id === atananKisiId));

  async function handleSubmit() {
    if (submitting.current || !baslik.trim() || !companyValid || !assigneeValid) return;
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

  const hasChanges = baslik !== (defaultBaslik ?? "") || firmaId !== (defaultFirmaId ?? "") || kaynak !== (defaultKaynak ?? "manuel") || (allowAssignee && atananKisiId !== "") || termin !== "" || oncelik !== (defaultOncelik ?? "normal");
  function requestClose() {
    if (submitting.current) return;
    if (hasChanges) setDiscardOpen(true);
    else resetAndClose();
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
    <>
    <ModalShell
      open={open}
      onClose={requestClose}
      closeDisabled={saving}
      title="Yeni Görev"
      footer={
        <>
          <button
            type="button"
            onClick={requestClose}
            disabled={saving}
            className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="submit"
            form={formId}
            disabled={!baslik.trim() || !companyValid || !assigneeValid || saving}
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
                İlgili kayıt bağlı
              </p>
              <p className="mt-1 text-xs text-blue-600">
                Bu görev, açtığınız {TASK_SOURCE_LABELS[kaynak].toLocaleLowerCase("tr-TR")} kaydına bağlı olacak.
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
          {allowCompany ? <div>
            <label htmlFor={`${formId}-firmaId`} className="block text-sm font-medium text-slate-700 mb-1">
              {isSourceLocked ? "Bağlı firma" : "Firma (isteğe bağlı)"}
            </label>
            <select required={isSourceLocked} id={`${formId}-firmaId`}
              disabled={isSourceLocked}
              aria-describedby={isSourceLocked ? `${formId}-company-context` : firmalarDurum !== "ready" || firmalar.length === 0 ? `${formId}-companies` : undefined}
              value={firmaId}
              onChange={(e) => {setFirmaId(e.target.value);if(!e.target.value)setKaynak("manuel");}}
              className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">{isSourceLocked ? "Firma seçin" : "Firma dışı görev"}</option>
              {firmaId && !firmalar.some(f => f.id === firmaId) && <option value={firmaId} disabled>{firmalarDurum === "ready" ? "Seçili firma listede yok" : "Seçili firma doğrulanıyor"}</option>}
              {firmalar.map((f) => (
                <option key={f.id} value={f.id} disabled={firmalarDurum !== "ready"}>
                  {f.ad}
                </option>
              ))}
            </select>
            {isSourceLocked && <p id={`${formId}-company-context`} className="mt-2 text-xs text-slate-600">
              {firmalarDurum === "loading"
                ? "Bağlı kaydın firması doğrulanıyor…"
                : companyValid
                  ? "Firma, bağlı kaydın firmasıdır. Başka bir firma için Görevler ekranından yeni görev açın."
                  : "Bağlı kaydın firması doğrulanamadı. Firma listesini yeniden yükleyin; sorun sürerse kaydı yeniden açın."}
            </p>}
            {!isSourceLocked && <p className="mt-2 text-xs text-slate-500">Firma seçmeden iç işler veya dışarıda yapılacak işler için görev açabilirsiniz.</p>}
            <PickerFeedback id={`${formId}-companies`} status={firmalarDurum} count={firmalar.length} name="Firma listesi"
              emptyText="Firma listesi boş. Firma dışı görev oluşturabilirsiniz." onRetry={onRetryFirmalar} />
          </div> : <p className="text-sm text-slate-600">{firmaId || isSourceLocked ? "Bu görevin firma bağlantısı artık kullanılamıyor. Firma bağlantısı olmadan yeni bir görev açın." : "Bu görev firma bağlantısı olmadan kaydedilecek."}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  aria-describedby={kullanicilarDurum !== "ready" || kullanicilar.length === 0 ? `${formId}-people` : undefined}
                  value={atananKisiId}
                  onChange={(e) => setAtananKisiId(e.target.value)}
                  disabled={kullanicilarDurum !== "ready" || (kullanicilar.length === 0 && !atananKisiId)}
                  className="min-h-11 min-w-0 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {kullanicilarDurum === "loading"
                      ? "Kullanıcılar yükleniyor…"
                      : kullanicilarDurum === "error"
                        ? "Kullanıcı listesi yüklenemedi"
                        : kullanicilar.length === 0
                          ? (atananKisiId ? "Atanmadan devam et" : "Atanabilecek kullanıcı yok")
                          : "Atanmadı"}
                  </option>
                  {atananKisiId && !kullanicilar.some(k => k.id === atananKisiId) && <option value={atananKisiId} disabled>{kullanicilarDurum === "ready" ? "Seçili kişi listede yok" : "Seçili kişi doğrulanıyor"}</option>}
                  {kullanicilar.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.ad}
                    </option>
                  ))}
                </select>
                {currentUserId && kullanicilarDurum === "ready" && kullanicilar.some(person=>person.id===currentUserId) && <button type="button" onClick={()=>setAtananKisiId(currentUserId)} disabled={atananKisiId===currentUserId} className="mt-1 min-h-11 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40">Bana ata</button>}
                {!atananKisiId&&<p className="mt-1 text-xs text-slate-500">Kişi seçmezseniz görev üstlenilmeyi bekler.</p>}
                <PickerFeedback id={`${formId}-people`} status={kullanicilarDurum} count={kullanicilar.length} name="Kişi listesi"
                  emptyText="Atanabilecek kişi yok. Görevi atamadan oluşturabilirsiniz." onRetry={onRetryKullanicilar} />
              </div>
              <TaskDueDateField id={`${formId}-termin`} value={termin} onChange={setTermin}/>
            </div>
          ) : <TaskDueDateField id={`${formId}-termin`} value={termin} onChange={setTermin}/>}
        </fieldset>
      </form>
    </ModalShell>
    {open && discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler"
      recordName={baslik.trim() || "Yeni görev"}
      description="Bu görev formundaki kaydedilmemiş bilgiler bırakılacak."
      confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardOpen(false)}
      onConfirm={async () => { setDiscardOpen(false); resetAndClose(); }} />}
    </>
  );
}
