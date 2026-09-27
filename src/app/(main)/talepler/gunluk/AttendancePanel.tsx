"use client";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/operations/pilot-types";
import AttendanceControls from "./AttendanceControls";

/** Removed assignments remain correctable without duplicating the current team. */
export default function AttendancePanel({ records, workers, future, disabled, onRecord }: {
  records: AttendanceRecord[]; workers: { id: string; name: string }[];
  future: boolean; disabled: boolean;
  onRecord: (record: AttendanceRecord, status: AttendanceStatus) => void;
}) {
  if (!records.length) return null;
  return <details className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Önceki atamalar ({records.length})</summary>
    <p className="text-xs text-slate-600">Listeden çıkarılan personelin önceki yoklamalarını burada görebilir ve düzeltebilirsiniz.</p>
    <ul className="mt-3 space-y-3">{records.map(record => {
      const name = workers.find(worker => worker.id === record.workerId)?.name ?? "Personel";
      return <li key={record.id} className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-sm font-medium">{name} · atama kaldırıldı</p>
        <AttendanceControls record={record} workerName={name} future={future} disabled={disabled} onRecord={onRecord} />
      </li>;
    })}</ul>
  </details>;
}
