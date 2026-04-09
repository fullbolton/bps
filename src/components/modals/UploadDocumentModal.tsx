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
}

interface UploadDocumentModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  onSubmit: (payload: UploadDocumentSubmitData) => Promise<void> | void;
}

export default function UploadDocumentModal({ open, onClose, firmalar, onSubmit }: UploadDocumentModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [evrakAdi, setEvrakAdi] = useState("");
  const [kategori, setKategori] = useState<DocumentCategory>("diger");
  const [gecerlilik, setGecerlilik] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset form state when modal opens
  useEffect(() => {
    if (open) {
      setFirmaId("");
      setEvrakAdi("");
      setKategori("diger");
      setGecerlilik("");
      setSaving(false);
      setSubmitError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!firmaId || !evrakAdi.trim() || saving) return;
    const firma = firmalar.find((f) => f.id === firmaId);
    const payload: UploadDocumentSubmitData = {
      firmaId,
      firmaAdi: firma?.ad ?? "",
      evrakAdi: evrakAdi.trim(),
      kategori,
      gecerlilikTarihi: gecerlilik,
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
        <button onClick={handleSubmit} disabled={!firmaId || !evrakAdi.trim() || saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
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
