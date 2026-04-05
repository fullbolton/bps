"use client";

import { useState } from "react";
import { ModalShell } from "@/components/ui";

interface AssignOwnerModalProps {
  open: boolean;
  onClose: () => void;
  talepRef?: string;
  talepId?: string;
  onSubmit?: (payload: { talepId: string; sorumlu: string }) => void;
}

export default function AssignOwnerModal({ open, onClose, talepRef, talepId, onSubmit }: AssignOwnerModalProps) {
  const [sorumlu, setSorumlu] = useState("");

  function handleSubmit() {
    if (!sorumlu.trim()) return;
    console.log("[demo] Sorumlu ata:", { talepRef, sorumlu: sorumlu.trim() });
    if (talepId) onSubmit?.({ talepId, sorumlu: sorumlu.trim() });
    resetAndClose();
  }

  function resetAndClose() {
    setSorumlu("");
    onClose();
  }

  return (
    <ModalShell open={open} onClose={resetAndClose} title="Sorumlu Ata" footer={
      <>
        <button onClick={resetAndClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50">İptal</button>
        <button onClick={handleSubmit} disabled={!sorumlu.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">Ata</button>
      </>
    }>
      <div className="space-y-4">
        {talepRef && (
          <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
            <p className="text-xs text-blue-700">Talep: {talepRef}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sorumlu Kişi <span className="text-red-500">*</span></label>
          <input type="text" value={sorumlu} onChange={(e) => setSorumlu(e.target.value)} placeholder="Kişi adı" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>
    </ModalShell>
  );
}
