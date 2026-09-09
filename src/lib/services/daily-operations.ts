import {validateDirectoryQuery,parseDirectoryPage,validateDirectoryActivation,parseDirectoryActivation} from "@/lib/operations/operations-directory";
import {buildOperationsChecklist} from "@/lib/operations/operations-checklist";
import {parseAttendanceWeek} from "@/lib/operations/weekly-attendance";
import { validateRequestBatch,parseBatchResult } from "@/lib/operations/request-batch";
import { parseWeeklyPlan,weekStart } from "@/lib/operations/weekly-plan";
import { validateCommandIds,parseCommandResolutions } from "@/lib/operations/command-reconciliation";
import type { CommandScope } from "@/lib/operations/pending-commands";
import { validateLocationRows } from "@/lib/operations/location-import";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { setDirectoryActive,selectOperationsDirectory,selectAttendanceWeek,replacePilotAssignment,recordPilotAttendance,resizePilotRequest,createPilotRequestBatch,selectPilotWeek,reconcilePilotCommands, executeScopedPilot, importPilotLocations, mutatePilot, selectPilotBoard, selectPilotCompanies } from "@/lib/supabase/daily-operations";
import { isUuid, parsePilotBoard, validatePilotPayload } from "@/lib/operations/pilot-validation";
import { isWorkDate } from "@/lib/operations/daily-demand";
import type { PilotKind } from "@/lib/operations/pilot-types";
type Client=SupabaseClient<Database>;

export async function listPilotCompanies(client:Client) {
  const rows=await selectPilotCompanies(client);
  if(!Array.isArray(rows)) throw new Error("Firma listesi doğrulanamadı.");
  return rows.map(r=>({id:r.id,name:r.name,active:r.status==="aktif"}));
}
export async function loadPilotBoard(client:Client,companyId:string,date:string) {
  if(!isUuid(companyId)||!isWorkDate(date)) throw new Error("Firma veya gün geçersiz.");
  return parsePilotBoard(await selectPilotBoard(client,companyId,date));
}
export async function runPilotCommand(client:Client,id:string,kind:PilotKind,payload:unknown,scope?:CommandScope) {
  if(!isUuid(id)) throw new Error("İşlem kimliği geçersiz.");
  const clean=validatePilotPayload(kind,payload);
  if((kind==="resize"||kind==="attendance"||kind==="replace")&&!scope)throw new Error("OPS_SCOPE_CHANGED");
  const data=kind==="replace"?await replacePilotAssignment(client,scope!.actorId,scope!.tenantId,id,clean.assignmentId as string,clean.workerId as string,clean.expectedRevision as number):kind==="attendance"?await recordPilotAttendance(client,scope!.actorId,scope!.tenantId,id,clean.assignmentId as string,clean.expectedRevision as number,clean.status as string):kind==="resize"?await resizePilotRequest(client,scope!.actorId,scope!.tenantId,id,clean.requestId as string,clean.expectedCount as number,clean.requiredCount as number):scope?await executeScopedPilot(client,scope.actorId,scope.tenantId,id,kind,clean):await mutatePilot(client,id,kind,clean);
  if(!data || typeof data!=="object" || Array.isArray(data) || !isUuid(data.id) || data.commandId!==id) throw new Error("İşlem sonucu doğrulanamadı. Aynı işlemi tekrar deneyin.");
  return {id:data.id,commandId:id};
}
export function pilotError(error:unknown,fallback="İşlem doğrulanamadı. Bağlantıyı kontrol edin; kayıt gönderdiyseniz aynı formu değiştirmeden tekrar deneyin.") {
  const raw=error && typeof error==="object" && "message" in error ? String(error.message):"";
  const messages:Record<string,string>={
    OPS_DIRECTORY_TOO_LARGE:"Dizin bu arama için çok büyük; daha dar bir arama kullanın.",
    OPS_ATTENDANCE_WEEK_TOO_LARGE:"Bu haftada 20000’den fazla tarihsel atama var; gerçekleşme özeti oluşturulamadı.",
    OPS_SAME_WORKER:"Yerine farklı bir personel seçin.",OPS_REPLACE_PRESENT:"Geldi bildirimi bulunan atama değiştirilemez. Bildirim hatalıysa önce düzeltin.",
    OPS_FUTURE_ATTENDANCE:"Gelecek gün için gerçekleşme bildirilemez.",OPS_ATTENDANCE_CONFLICT:"Bu personelin aynı gün başka bir atamada Geldi kaydı var. Önce hatalı bildirimi düzeltin.",
    OPS_BELOW_ASSIGNED:"Kişi sayısı mevcut atama sayısından az olamaz. Önce ilgili atamayı kaldırın.",OPS_BATCH_EXISTS:"Seçilen günlerde aynı şube, hizmet ve pozisyon için aktif talep var. Hiçbir yeni talep oluşturulmadı; günleri kontrol edin.",OPS_WEEK_TOO_LARGE:"Bu haftada 5000’den fazla talep var; çıktı oluşturulamadı.",OPS_SCOPE_CHANGED:"Hesap veya çalışma alanı değişti. Sayfayı yenileyin; eski işlem gönderilmedi.",OPS_IMPORT_CONFLICT:"Aynı şube kodu farklı içerikle mevcut. Hiçbir satır aktarılmadı.",OPS_IMPORT_DUPLICATE:"Dosyada tekrarlanan şube kodu var.",
    OPS_FORBIDDEN:"Bu işlem için yetkiniz yok.",OPS_UNAUTHENTICATED:"Oturumunuzu yenileyin.",
    OPS_OUT_OF_SCOPE:"Kayıt bulunamadı veya erişim yetkiniz yok.",OPS_CAPACITY_FULL:"Bu talebin kapasitesi doldu.",
    OPS_WORKER_CONFLICT:"Personelin bu gün için başka bir ataması var.",OPS_INACTIVE_COMPANY:"Pasif firmaya yeni işlem yapılamaz.",
    OPS_INACTIVE_LOCATION:"Lokasyon aktif değil veya erişilemiyor.",OPS_INACTIVE_WORKER:"Personel aktif değil veya erişilemiyor.",
    OPS_REQUEST_NOT_ACTIVE:"Talep artık atama kabul etmiyor.",OPS_STALE_VERSION:"Kayıt değişmiş; görünümü yenileyin.",
    OPS_IDEMPOTENCY_MISMATCH:"İşlem içeriği değişti. Görünümü yenileyip yeniden deneyin.",OPS_VALIDATION:"Girdi doğrulanamadı."};
  for(const [key,message] of Object.entries(messages)) if(raw.includes(key)) return message;
  if(error && typeof error==="object" && "code" in error && error.code==="23505") return "Aynı kod veya gün için kayıt zaten var. Görünümü yenileyin.";
  return fallback;
}

export async function runLocationImport(client:Client,commandId:string,companyId:string,rows:unknown,scope?:CommandScope) {
  if(!isUuid(commandId)||!isUuid(companyId))throw new Error("OPS_VALIDATION");
  const clean=validateLocationRows(rows);
  const data=scope?await executeScopedPilot(client,scope.actorId,scope.tenantId,commandId,"location_import",{companyId,rows:clean}):await importPilotLocations(client,commandId,companyId,clean);
  if(!data||typeof data!=="object"||Array.isArray(data)||data.commandId!==commandId||
    typeof data.added!=="number"||typeof data.skipped!=="number"||!Number.isInteger(data.added)||!Number.isInteger(data.skipped)||
    data.added<0||data.skipped<0||data.added+data.skipped!==(rows as unknown[]).length)throw new Error("OPS_UNVERIFIABLE");
  return {added:data.added,skipped:data.skipped};
}

export async function reconcilePilot(client:Client,scope:CommandScope,ids:unknown,close:boolean){
  if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId)||typeof close!=="boolean")throw new Error("OPS_VALIDATION");
  const clean=validateCommandIds(ids);
  return parseCommandResolutions(clean,await reconcilePilotCommands(client,scope.actorId,scope.tenantId,clean,close));
}

export async function loadPilotWeek(client:Client,companyId:string,date:string){
  if(!isUuid(companyId))throw new Error("OPS_VALIDATION");
  const start=weekStart(date);
  return parseWeeklyPlan(await selectPilotWeek(client,companyId,start),companyId,start);
}

export async function runRequestBatch(client:Client,scope:CommandScope,id:string,payload:unknown){
  if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId)||!isUuid(id))throw new Error("OPS_VALIDATION");
  const clean=validateRequestBatch(payload);
  return parseBatchResult(id,clean.dates.length,await createPilotRequestBatch(client,scope.actorId,scope.tenantId,id,clean));
}

export async function loadAttendanceWeek(client:Client,companyId:string,date:string){
  if(!isUuid(companyId))throw new Error("OPS_VALIDATION");
  const start=weekStart(date);
  return parseAttendanceWeek(await selectAttendanceWeek(client,companyId,start),companyId,start);
}

export async function loadOperationsChecklist(client:Client,companyId:string,date:string){
  return buildOperationsChecklist(await loadAttendanceWeek(client,companyId,date),date);
}

export async function loadOperationsDirectory(client:Client,query:unknown){
  const q=validateDirectoryQuery(query);
  return parseDirectoryPage(await selectOperationsDirectory(client,q),q);
}

export async function runDirectoryActivation(client:Client,scope:CommandScope,id:string,payload:unknown){
  if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId)||!isUuid(id))throw new Error("OPS_SCOPE_CHANGED");
  const p=validateDirectoryActivation(payload);
  return parseDirectoryActivation(await setDirectoryActive(client,scope.actorId,scope.tenantId,id,p),id,p);
}
