"use client";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/operations/pilot-types";

const labels: Record<AttendanceStatus, string> = {
  unreported: "Yoklama bekliyor", present: "Geldi", absent: "Gelmedi",
};

export default function AttendanceControls({ record, workerName, future, disabled, onRecord }: {
  record: AttendanceRecord;
  workerName: string;
  future: boolean;
  disabled: boolean;
  onRecord: (record: AttendanceRecord, status: AttendanceStatus) => void;
}) {
  return <div className="space-y-2">
    <p className="text-xs text-slate-600">Yoklama: <strong>{labels[record.status]}</strong>{record.removed && " · Atama kaldırıldı; yoklama değiştirilemez."}{future && " · Yoklamayı iş günü geldiğinde girebilirsiniz."}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={`${workerName} yoklama`}>
      {(["present", "absent"] as const).map(status => <button
        type="button" key={status} aria-pressed={record.status === status}
        disabled={disabled || future || record.removed || record.status === status}
        className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-default ${record.status === status ? status === "present" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"}`}
        onClick={() => onRecord(record, status)}>{labels[status]}</button>)}
      {record.status !== "unreported" && <button type="button"
        disabled={disabled || future || record.removed} className="min-h-11 px-3 py-2 text-xs text-slate-600 underline disabled:opacity-40"
        onClick={() => onRecord(record, "unreported")}>Yoklamayı geri al</button>}
    </div>
  </div>;
}
