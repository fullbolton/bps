export type PilotKind = "location" | "worker" | "request" | "assign" | "remove" | "cancel" | "resize" | "attendance" | "replace";
export type AttendanceStatus = "unreported" | "present" | "absent";
export type AttendanceRecord = {id:string;workerId:string;status:AttendanceStatus;revision:number;removed:boolean};
export type PilotCompany = { id: string; name: string; active: boolean };
export type PilotBoard = {
  locations: { id: string; name: string; city: string; active: boolean }[];
  workers: { id: string; name: string; code: string; active: boolean; booked: boolean }[];
  requests: { id: string; locationId: string; workDate: string; serviceLine: string;
    position: string; requiredCount: number; lifecycle: "active" | "cancelled";
    attendance: AttendanceRecord[];
    assignments: { id: string; workerId: string }[] }[];
};
export type PilotResult<T> = { ok: true; data: T } | { ok: false; message: string };
