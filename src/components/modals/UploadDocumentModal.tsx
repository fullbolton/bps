"use client";

import { useState, useEffect, useRef, useId } from "react";
import { DocumentUploadReviewRequiredError } from "@/lib/company-document-upload";
import ConfirmActionDialog from "@/components/ui/ConfirmActionDialog";
import { ModalShell } from "@/components/ui";
import {DOCUMENT_FOLDERS} from "@/lib/document-folders";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";
import type { DocumentCategory } from "@/lib/document-categories";

export interface UploadDocumentSubmitData {
  firmaId: string;
  firmaAdi: string;
  evrakAdi: string;
  kategori: DocumentCategory;
  gecerlilikTarihi: string;
  file: File;
}

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  companiesState: "loading" | "error" | "ready";
  onRetryCompanies: () => void;
  onSubmit: (payload: UploadDocumentSubmitData) => Promise<void> | void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function UploadDocumentModal(props: UploadDocumentModalProps) {
  return props.open ? <UploadDocumentDraft {...props} /> : null;
}
function UploadDocumentDraft({ onClose, firmalar, onSubmit, companiesState, onRetryCompanies }: UploadDocumentModalProps) {
  const formId = useId();
  const submitting = useRef(false);
  const mounted = useRef(true);
  const [discardOpen, setDiscardOpen] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [firmaId, setFirmaId] = useState("");
  const [evrakAdi, setEvrakAdi] = useState("");
  const [kategori, setKategori] = useState<DocumentCategory>("diger");
  const [gecerlilik, setGecerlilik] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (submitError) { errorRef.current?.focus({ preventScroll: true }); errorRef.current?.scrollIntoView({ block: "nearest" }); }
  }, [submitError]);

  const companyReady = companiesState === "ready" && firmalar.some(f => f.id === firmaId);
  const dirty = firmaId !== "" || evrakAdi !== "" || kategori !== "diger" || gecerlilik !== "" || !!file || !!fileError;
  function requestClose() {
    if (submitting.current) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (picked.size === 0) { setFile(null); setFileError("Boş dosya yüklenemez."); e.target.value = ""; return; }
    if (picked.type !== "application/pdf") {
      setFile(null);
      setFileError("Sadece PDF dosyasi yuklenebilir."); e.target.value = "";
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError("Dosya boyutu 10 MB'dan buyuk olamaz."); e.target.value = "";
      return;
    }
    setFile(picked);
    setFileError(null);
  }

  async function handleSubmit() {
    if (!companyReady || !evrakAdi.trim() || !file || submitting.current || reviewRequired) return;
    submitting.current = true;
    const firma = firmalar.find((f) => f.id === firmaId);
    const payload: UploadDocumentSubmitData = {
      firmaId,
      firmaAdi: firma?.ad ?? "",
      evrakAdi: evrakAdi.trim(),
      kategori,
      gecerlilikTarihi: gecerlilik,
      file,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit(payload);
      if (mounted.current) onClose();
    } catch (err) {
      if (!mounted.current) return;
      if (err instanceof DocumentUploadReviewRequiredError) setReviewRequired(true);
      setSubmitError(err instanceof Error ? err.message : "Evrak yuklenemedi.");
    } finally {
      submitting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (<>
    <ModalShell open onClose={requestClose} closeDisabled={saving} title="Evrak Yukle" footer={
      <>
        <button type="button" onClick={requestClose} disabled={saving} className="min-h-11 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Iptal</button>
        <button type="submit" form={formId} disabled={!companyReady || !evrakAdi.trim() || !file || saving || reviewRequired} className="min-h-11 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? "Kaydediliyor..." : "Yukle"}
        </button>
      </>
    }>
      <form id={formId} onSubmit={event => { event.preventDefault(); void handleSubmit(); }} aria-busy={saving}>
      <fieldset disabled={saving} className="space-y-4 min-w-0">
        {submitError && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
        )}
        <div>
          <label htmlFor={`${formId}-company`} className="block text-sm font-medium text-slate-700 mb-1">Firma <span className="text-red-500">*</span></label>
          <select id={`${formId}-company`} data-dialog-initial-focus value={firmaId} onChange={(e) => setFirmaId(e.target.value)} disabled={saving || companiesState !== "ready"} className="min-h-11 w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Firma secin</option>
            {firmalar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
          {companiesState === "loading" && <p role="status" className="mt-2 text-sm text-slate-500">Firmalar yükleniyor…</p>}
          {companiesState === "error" && <div className="mt-2 text-sm"><p role="status">Firmalar yüklenemedi.</p><button type="button" onClick={onRetryCompanies} className="min-h-11 text-blue-700 underline">Firmaları yeniden dene</button></div>}
          {companiesState === "ready" && firmalar.length === 0 && <p className="mt-2 text-sm text-slate-500">Seçilebilir firma bulunamadı.</p>}
        </div>
        <div>
          <label htmlFor={`${formId}-file`} className="block text-sm font-medium text-slate-700 mb-1">Dosya (PDF) <span className="text-red-500">*</span></label>
          <input id={`${formId}-file`} required type="file" accept="application/pdf" onChange={handleFileChange} disabled={saving} className="w-full text-sm text-slate-700 file:mr-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-slate-50 file:border file:border-slate-200 file:rounded-md file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-40" />
          {file && !fileError && (
            <p className="mt-1 text-xs text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>
          )}
          {fileError && (
            <p className="mt-1 text-xs text-red-600">{fileError}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">Maksimum 10 MB, sadece PDF.</p>
        </div>
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-slate-700 mb-1">Evrak Adi <span className="text-red-500">*</span></label>
          <input id={`${formId}-name`} required type="text" value={evrakAdi} onChange={(e) => setEvrakAdi(e.target.value)} disabled={saving} placeholder="Evrak adini girin" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-category`} className="block text-sm font-medium text-slate-700 mb-1">Klasör / belge türü</label>
            <select id={`${formId}-category`} value={kategori} onChange={(e) => setKategori(e.target.value as DocumentCategory)} disabled={saving} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {DOCUMENT_FOLDERS.map(folder=><optgroup key={folder.id} label={folder.name}>{folder.categories.map(k=><option key={k} value={k}>{DOCUMENT_CATEGORY_LABELS[k]}</option>)}</optgroup>)}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-date`} className="block text-sm font-medium text-slate-700 mb-1">Gecerlilik Tarihi</label>
            <input id={`${formId}-date`} type="date" value={gecerlilik} onChange={(e) => setGecerlilik(e.target.value)} disabled={saving} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </fieldset>
      {saving && <p role="status" className="mt-4 text-sm text-blue-700">Evrak yükleniyor, lütfen bekleyin…</p>}
      </form>
    </ModalShell>
    {discardOpen && <ConfirmActionDialog title="Kaydedilmemiş değişiklikler" recordName="Evrak yükleme taslağı" description="Seçilen dosya ve form bilgileri bırakılacak." confirmLabel="Değişiklikleri bırak" destructive onClose={() => setDiscardOpen(false)} onConfirm={async () => { if (!submitting.current) onClose(); }} />}
  </>);
}
