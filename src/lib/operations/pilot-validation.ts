import { isWorkDate, validateDailyDemand } from "./daily-demand";
import type { PilotBoard, PilotKind } from "./pilot-types";

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
export function validatePilotPayload(kind: PilotKind, value: unknown): Record<string,string|number> {
  if (!record(value)) throw new Error("Form verisi geçersiz.");
  const keys: Record<PilotKind,string[]> = {location:["companyId","name","city"],worker:["name","code","kind"],request:["companyId","locationId","serviceLine","position","workDate","requiredCount"],assign:["requestId","workerId"],remove:["requestId","assignmentId"],cancel:["requestId"],resize:["requestId","expectedCount","requiredCount"],attendance:["assignmentId","expectedRevision","status"],replace:["assignmentId","workerId","expectedRevision"]};
  if (!Object.hasOwn(keys,kind)) throw new Error("İşlem geçersiz.");
  const result: Record<string,string|number> = {};
  for (const key of keys[kind]) {
    const v=value[key];
    if (key.endsWith("Id")) { if (!isUuid(v)) throw new Error("Kayıt kimliği geçersiz."); result[key]=v; }
    else if(key==="expectedRevision") { if(typeof v!=="number"||!Number.isInteger(v)||v<0||v>2147483646)throw new Error("Bildirim sürümü geçersiz."); result[key]=v; }
    else if(key==="status") { if(v!=="unreported"&&v!=="present"&&v!=="absent")throw new Error("Gerçekleşme durumu geçersiz.");result[key]=v; }
    else if (key==="requiredCount"||key==="expectedCount") { if(typeof v!=="number" || !Number.isInteger(v) || v<1 || v>100) throw new Error("Kişi sayısı 1–100 arasında olmalıdır."); result[key]=v; }
    else if (key==="workDate") { if(!isWorkDate(v) || v<"2000-01-01" || v>"2100-12-31") throw new Error("Tarih 2000–2100 arasında geçerli bir gün olmalıdır."); result[key]=v; }
    else if (key==="kind") { if(v!=="idp" && v!=="sabit") throw new Error("Personel türü geçersiz."); result[key]=v; }
    else { if(!text(v,key==="name"?160:key==="code"?40:80)) throw new Error("Zorunlu alanları ve metin uzunluklarını kontrol edin."); result[key]=v.trim(); }
  }
  if(kind==="request" && !validateDailyDemand(result).ok) throw new Error("Talep verisi geçersiz.");
  return result;
}

export function parsePilotBoard(v: unknown): PilotBoard {
  if(!record(v) || !Array.isArray(v.locations) || !Array.isArray(v.workers) || !Array.isArray(v.requests)) throw new Error("Plan verisi doğrulanamadı.");
  if(!v.locations.every(r=>record(r)&&isUuid(r.id)&&text(r.name,160)&&text(r.city,80)&&typeof r.active==="boolean") ||
    !v.workers.every(r=>record(r)&&isUuid(r.id)&&text(r.name,160)&&text(r.code,40)&&typeof r.active==="boolean"&&typeof r.booked==="boolean") ||
    !v.requests.every(r=>record(r)&&isUuid(r.id)&&isUuid(r.locationId)&&isWorkDate(r.workDate)&&text(r.serviceLine,80)&&text(r.position,80)&&
      typeof r.requiredCount==="number"&&Number.isInteger(r.requiredCount)&&r.requiredCount>=1&&r.requiredCount<=100&&
      (r.lifecycle==="active"||r.lifecycle==="cancelled")&&Array.isArray(r.attendance)&&r.attendance.every(a=>record(a)&&isUuid(a.id)&&isUuid(a.workerId)&&typeof a.status==="string"&&["unreported","present","absent"].includes(a.status)&&typeof a.revision==="number"&&Number.isInteger(a.revision)&&a.revision>=0&&a.revision<=2147483647&&typeof a.removed==="boolean")&&
      Array.isArray(r.assignments)&&r.assignments.length<=r.requiredCount&&
      (r.lifecycle!=="cancelled"||r.assignments.length===0)&&r.assignments.every(a=>record(a)&&isUuid(a.id)&&isUuid(a.workerId)))) throw new Error("Plan verisi doğrulanamadı.");
  const board=v as PilotBoard;
  const ids=new Set<string>();const presentWorkers=new Set<string>();
  for(const r of board.requests){
    for(const a of r.attendance){
      if(ids.has(a.id)||(a.status==="present"&&presentWorkers.has(a.workerId)))throw new Error("Gerçekleşme verisi doğrulanamadı.");
      ids.add(a.id);if(a.status==="present")presentWorkers.add(a.workerId);
    }
    const active=r.attendance.filter(a=>!a.removed);
    if(active.length!==r.assignments.length||!r.assignments.every(a=>active.some(x=>x.id===a.id&&x.workerId===a.workerId)))throw new Error("Atama ve gerçekleşme verisi uyuşmuyor.");
  }
  return board;
}
