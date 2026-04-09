"use client";

/**
 * NewAppointmentModal — Phase 3B cutover.
 *
 * Imports moved from mocks/randevular to lib/appointment-types.
 * onSubmit is now async — the parent awaits the service-layer call
 * and this modal shows a saving spinner + inline error on failure.
 */

import { useState } from "react";
import { ModalShell } from "@/components/ui";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/appointment-types";
import type { AppointmentMeetingType } from "@/lib/appointment-types";

interface NewAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  firmalar: { id: string; ad: string }[];
  onSubmit?: (payload: {
    firmaId: string;
    firmaAdi: string;
    tarih: string;
    saat: string;
    gorusmeTipi: AppointmentMeetingType;
    katilimci: string;
  }) => Promise<void> | void;
}

export default function NewAppointmentModal({
  open,
  onClose,
  firmalar,
  onSubmit,
}: NewAppointmentModalProps) {
  const [firmaId, setFirmaId] = useState("");
  const [tarih, setTarih] = useState("");
  const [saat, setSaat] = useState("");
  const [tip, setTip] = useState<AppointmentMeetingType>("ziyaret");
  const [katilimci, setKatilimci] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!firmaId || !tarih) return;
    const payload = {
      firmaId,
      firmaAdi: firmalar.find((f) => f.id === firmaId)?.ad ?? "",
      tarih,
      saat,
      gorusmeTipi: tip,
      katilimci,
    };
    setSaving(true);
    setSubmitError(null);
    try {
      await onSubmit?.(payload);
      resetAndClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Randevu olusturulurken bir hata olustu.",
      );
    } finally {
      setSaving(false);
    }
  }

  function resetAndClose() {
    setFirmaId("");
    setTarih("");
    setSaat("");
    setTip("ziyaret");
    setKatilimci("");
    setSubmitError(null);
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={resetAndClose}
      title="Yeni Randevu"
      footer={
        <>
          <button
            onClick={resetAndClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40"
          >
            Iptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!firmaId || !tarih || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Kaydediliyor..." : "Olustur"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <p className="text-xs text-red-600" role="alert" aria-live="polite">
            {submitError}
          </p>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Firma <span className="text-red-500">*</span>
          </label>
          <select
            value={firmaId}
            onChange={(e) => setFirmaId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Firma secin</option>
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
              Tarih <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Saat
            </label>
            <input
              type="time"
              value={saat}
              onChange={(e) => setSaat(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Gorusme Tipi
          </label>
          <select
            value={tip}
            onChange={(e) => setTip(e.target.value as AppointmentMeetingType)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentMeetingType[]).map((t) => (
              <option key={t} value={t}>
                {APPOINTMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Katilimci
          </label>
          <input
            type="text"
            value={katilimci}
            onChange={(e) => setKatilimci(e.target.value)}
            placeholder="Katilimci adi"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </ModalShell>
  );
}
