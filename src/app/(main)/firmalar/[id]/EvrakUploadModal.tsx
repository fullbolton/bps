"use client";

import {useEffect, useId, useRef, useState} from 'react';
import {ModalShell} from '@/components/ui';
import ConfirmActionDialog from '@/components/ui/ConfirmActionDialog';
import {DOCUMENT_CATEGORY_LABELS, type DocumentCategory} from '@/lib/document-categories';
import {uploadCompanyDocumentAction} from './actions';

// ---------------------------------------------------------------------------
// EvrakUploadModal — page-local upload form.
//
// Server-action backed (see `./actions.ts > uploadCompanyDocumentAction`).
// The component itself only collects inputs and forwards them as
// FormData; identity / tenant / company / audit fields are set by the
// action against the cookie-derived session. The browser never sees a
// signed URL it can persist, never sees a service-role client, and
// never writes directly to `documents`.
// ---------------------------------------------------------------------------

interface EvrakUploadModalProps {
  companyId: string;
  companyName: string;
  contracts: { id: string; name: string }[];
  contractsState: "loading" | "error" | "restricted" | "ready" | "disabled";
  onRetryContracts: () => void;
  submitError: string | null;
  onClose: () => void;
  onSubmitError: (err: string) => void;
  onSuccess: (name: string) => void;
}

export default function EvrakUploadModal({companyId, companyName, contracts, contractsState, onRetryContracts, submitError, onClose, onSubmitError, onSuccess}: EvrakUploadModalProps) {
  const formId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<DocumentCategory>("diger");
  const [contractId, setContractId] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (submitError) { errorRef.current?.focus({ preventScroll: true }); errorRef.current?.scrollIntoView({ block: "nearest" }); }
  }, [submitError]);
  const saving = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const contractVerified = contractsState === "ready" && contracts.some(c => c.id === contractId);
  const canSubmit = !!file && name.trim().length > 0 && !submitting && !contractId && !reviewRequired;
  const dirty = !!file || !!fileError || name !== "" || category !== "diger" || contractId !== "" || validityDate !== "";
  function requestClose() {
    if (saving.current) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setFile(null); setFileError(null);
    if (!picked) return;
    const error = picked.type !== "application/pdf" ? "Sadece PDF dosyası yüklenebilir."
      : picked.size === 0 ? "Boş dosya yüklenemez."
      : picked.size > 10 * 1024 * 1024 ? "Dosya boyutu 10 MB'dan büyük olamaz." : null;
    if (error) { setFileError(error); event.target.value = ""; return; }
    setFile(picked);
  }
  async function handleSubmit() {
    if (!canSubmit || !file || saving.current) return;
    saving.current = true; setSubmitting(true); onSubmitError("");
    const fd = new FormData();
    fd.set("company_id", companyId); fd.set("name", name.trim()); fd.set("category", category);
    if (contractId) fd.set("contract_id", contractId);
    if (validityDate) fd.set("validity_date", validityDate);
    fd.set("file", file);
    try {
      const result = await uploadCompanyDocumentAction(fd);
      if (!mounted.current) return;
      if (result.ok) onSuccess(name.trim());
      else { setReviewRequired(result.reviewRequired === true); onSubmitError(result.error); }
    } catch {
      if (mounted.current) { setReviewRequired(true); onSubmitError("Yükleme sonucu alınamadı. Tekrar denemeden önce belge listesini kontrol edin."); }
    } finally {
      saving.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }
  const fieldClass = "min-h-11 w-full min-w-0 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  return <>
    <ModalShell open onClose={requestClose} closeDisabled={submitting} title="Belge Yükle" footer={<>
      <button type="button" onClick={requestClose} disabled={submitting} className="min-h-11 px-4 py-2 text-sm border border-slate-200 rounded-md disabled:opacity-40">İptal</button>
      <button type="submit" form={formId} disabled={!canSubmit} className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40">{submitting ? "Yükleniyor…" : "Yükle"}</button>
    </>}>
      <p className="mb-4 break-words text-sm text-slate-500">{companyName}</p>
      <form id={formId} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} aria-busy={submitting}>
        <fieldset disabled={submitting} className="space-y-4 min-w-0">
          <div>
            <label htmlFor={`${formId}-name`} className={labelClass}>Belge Adı *</label>
            <input id={`${formId}-name`} data-dialog-initial-focus required value={name} onChange={e => setName(e.target.value)} placeholder="Belge adını girin" className={fieldClass} />
          </div>
          <div>
            <label htmlFor={`${formId}-file`} className={labelClass}>Dosya (PDF) *</label>
            <input id={`${formId}-file`} type="file" accept="application/pdf" required onChange={handleFileChange} aria-describedby={`${formId}-file-hint`} className="min-h-11 w-full min-w-0 text-sm file:mr-2 file:min-h-11 file:rounded-md file:border file:border-slate-200 file:bg-slate-50" />
            <p id={`${formId}-file-hint`} className="mt-1 text-xs text-slate-500">Maksimum 10 MB, sadece PDF.</p>
            {file && <p className="mt-1 break-words text-xs text-slate-500">Seçilen: {file.name}</p>}
            {fileError && <p role="alert" className="mt-1 text-sm text-red-600">{fileError}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label htmlFor={`${formId}-category`} className={labelClass}>Kategori</label>
              <select id={`${formId}-category`} value={category} onChange={e => setCategory(e.target.value as DocumentCategory)} className={fieldClass}>
                {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map(k => <option key={k} value={k}>{DOCUMENT_CATEGORY_LABELS[k]}</option>)}
              </select>
            </div>
            <div><label htmlFor={`${formId}-date`} className={labelClass}>Geçerlilik (opsiyonel)</label>
              <input id={`${formId}-date`} type="date" value={validityDate} onChange={e => setValidityDate(e.target.value)} className={fieldClass} />
            </div>
          </div>
          {contractsState !== "disabled" && <div>
            <label htmlFor={`${formId}-contract`} className={labelClass}>Sözleşme dosyaları</label>
            <select id={`${formId}-contract`} value={contractId} onChange={e => setContractId(e.target.value)} disabled={contractsState !== "ready"} className={fieldClass}>
              <option value="">Firma belgesi yükle</option>
              {contractId && !contractVerified && <option value={contractId}>Önceki seçim doğrulanamadı</option>}
              {contractsState === "ready" && contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {contractsState === "loading" && <p role="status" className="mt-2 text-sm text-slate-500">Sözleşmeler yükleniyor. Sözleşmeye bağlamadan yükleyebilirsiniz.</p>}
            {contractsState === "error" && <div className="mt-2 text-sm"><p role="status">Sözleşmeler yüklenemedi. Sözleşmeye bağlamadan yükleyebilir veya yeniden deneyebilirsiniz.</p><button type="button" onClick={onRetryContracts} className="min-h-11 text-blue-700 underline">Sözleşmeleri yeniden dene</button></div>}
            {contractsState === "restricted" && <p className="mt-2 text-sm text-slate-500">Bu rolde sözleşme seçilemez. Belge firmaya yüklenir.</p>}
            {contractsState === "ready" && contracts.length === 0 && <p className="mt-2 text-sm text-slate-500">Bu firmaya ait sözleşme kaydı yok. Belge firmaya yüklenir.</p>}
            {contractId && contractVerified && <div className="mt-2 space-y-2 text-sm">
              <p>Sözleşmenin ana PDF ve eklerini sözleşme sayfasından yönetin. Seçilen dosya bu formda korunur; dosyayı açılan sayfada yeniden seçmeniz gerekir.</p>
              <a href={`/sozlesmeler/${contractId}#belgeler`} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center text-blue-700 underline">Sözleşme dosyalarını aç (yeni sekme)</a>
              <button type="button" onClick={() => setContractId("")} className="min-h-11 block text-blue-700 underline">Firma belgesi olarak devam et</button>
            </div>}
            {contractId && !contractVerified && <div className="mt-2 text-sm"><p role="status">Seçilen sözleşme doğrulanmadan yükleme yapılamaz.</p><button type="button" onClick={() => setContractId("")} className="min-h-11 text-blue-700 underline">Sözleşme seçimini kaldır</button></div>}
          </div>}
          {contractsState === "disabled" && <div className="text-sm text-slate-500">
            <p>Sözleşmeler modülü kapalı. Firma belgesi yükleyebilirsiniz.</p>
            {contractId && <><p role="status">Devam etmek için önceki sözleşme seçimini kaldırın. Dosyanız korunur.</p><button type="button" onClick={() => setContractId("")} className="min-h-11 text-blue-700 underline">Sözleşme seçimini kaldır</button></>}
          </div>}
        </fieldset>
        {submitting && <p role="status" className="mt-4 text-sm text-blue-700">Belge yükleniyor, lütfen bekleyin…</p>}
        {submitError && <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 break-words text-sm text-red-600">{submitError}</p>}
      </form>
    </ModalShell>
    {discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler" recordName="Belge yükleme taslağı" description="Seçilen dosya ve form bilgileri bırakılacak." confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardOpen(false)} onConfirm={async () => { if (!saving.current) onClose(); }} />}
  </>;
}
