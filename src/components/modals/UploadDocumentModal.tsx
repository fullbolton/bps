"use client";

import { useState, useEffect } from "react";
import { ModalShell } from "@/components/ui";
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
  onSubmit: (payload: UploadDocumentSubmitData) => Promise<void> | void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export default function UploadDocumentModal({ open, onClose, firmalar, onSubmit }: UploadDocumentModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [evrakAdi, setEvrakAdi] = useState("");
  const [kategori, setKategori] = useState<DocumentCategory>("diger");
  const [gecerlilik, setGecerlilik] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      setFirmaId("");
      setEvrakAdi("");
      setKategori("diger");
      setGecerlilik("");
      setFile(null);
      setFileError(null);
      setSaving(false);
      setSubmitError(null);
    }
  }, [open]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    if (!picked) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (picked.type !== "application/pdf") {
      setFile(null);
      setFileError("Sadece PDF dosyasi yuklenebilir.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      setFile(null);
      setFileError("Dosya boyutu 10 MB'dan buyuk olamaz.");
      return;
    }
    setFile(picked);
    setFileError(null);
  }

  async function handleSubmit() {
    if (!firmaId || !evrakAdi.trim() || !file || saving) return;
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
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Evrak yuklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose} title="Evrak Yukle" footer={
      <>
        <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40">Iptal</button>
        <button onClick={handleSubmit} disabled={!firmaId || !evrakAdi.trim() || !file || saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? "Kaydediliyor..." : "Yukle"}
        </button>
      </>
    }>
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Firma <span className="text-red-500">*</span></label>
          <select value={firmaId} onChange={(e) => setFirmaId(e.target.value)} disabled={saving} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Firma secin</option>
            {firmalar.map((f) => <option key={f.id} value={f.id}>{f.ad}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Dosya (PDF) <span className="text-red-500">*</span></label>
          <input type="file" accept="application/pdf" onChange={handleFileChange} disabled={saving} className="w-full text-sm text-slate-700 file:mr-3 file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-slate-50 file:border file:border-slate-200 file:rounded-md file:text-slate-700 hover:file:bg-slate-100 disabled:opacity-40" />
          {file && !fileError && (
            <p className="mt-1 text-xs text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>
          )}
          {fileError && (
            <p className="mt-1 text-xs text-red-600">{fileError}</p>
          )}
          <p className="mt-1 text-xs text-slate-500">Maksimum 10 MB, sadece PDF.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Evrak Adi <span className="text-red-500">*</span></label>
          <input type="text" value={evrakAdi} onChange={(e) => setEvrakAdi(e.target.value)} disabled={saving} placeholder="Evrak adini girin" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kategori</label>
            <select value={kategori} onChange={(e) => setKategori(e.target.value as DocumentCategory)} disabled={saving} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).map((k) => <option key={k} value={k}>{DOCUMENT_CATEGORY_LABELS[k]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gecerlilik Tarihi</label>
            <input type="date" value={gecerlilik} onChange={(e) => setGecerlilik(e.target.value)} disabled={saving} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
