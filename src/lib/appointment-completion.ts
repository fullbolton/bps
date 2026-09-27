import { isUuid } from "@/lib/operations/pilot-validation";
export type CompletionInput = {result:string;nextAction:string;createTask?:boolean};
export type CompletionResult = {appointmentId:string;taskId:string|null;taskSkippedReason:string|null};
export function validateCompletion(input:unknown):Required<CompletionInput> {
  const p=input as Partial<CompletionInput>|null;
  if(!p||typeof p.result!=="string"||typeof p.nextAction!=="string"||
    (p.createTask!==undefined&&typeof p.createTask!=="boolean"))throw new Error("Sonuç ve sonraki adım geçersiz.");
  const result=p.result.trim(),nextAction=p.nextAction.trim();
  if(!result||result.length>4000||!nextAction||nextAction.length>1000)throw new Error("Sonuç 1–4000, sonraki adım 1–1000 karakter olmalıdır.");
  return {result,nextAction,createTask:p.createTask??false};
}
export function parseCompletion(value:unknown,appointmentId:string,createTask:boolean):CompletionResult {
  const p=value as Partial<CompletionResult>|null;
  if(!p||p.appointmentId!==appointmentId||!(p.taskId===null||isUuid(p.taskId))||
    !(p.taskSkippedReason===null||(typeof p.taskSkippedReason==="string"&&p.taskSkippedReason.trim().length>0))||
    (p.taskId!==null&&p.taskSkippedReason!==null)||
    (createTask&&p.taskId===null&&p.taskSkippedReason===null)||
    (!createTask&&(p.taskId!==null||p.taskSkippedReason!==null)))throw new Error("Randevu işlem sonucu doğrulanamadı. Aynı içerikle tekrar deneyin.");
  return p as CompletionResult;
}
export function completionError(error:unknown):Error {
  const raw=error&&typeof error==="object"&&"message" in error?String(error.message):"";
  const messages:Record<string,string>={APPT_SCOPE_CHANGED:"Hesap veya çalışma alanı değişti. Sayfayı yenileyin.",APPT_FORBIDDEN:"Bu randevuyu tamamlama yetkiniz yok.",APPT_NOT_FOUND:"Randevu bulunamadı veya erişim yetkiniz yok.",APPT_VALIDATION:"Randevu sonucu veya sonraki adım geçersiz.",APPT_ALREADY_COMPLETED:"Randevu daha önce tamamlanmış veya farklı içerikle kaydedilmiş. Güncel listeyi yükleyin.",APPT_STATE_CHANGED:"Randevu tamamlandıktan sonra değiştirilmiş. Güncel kaydı inceleyin."};
  for(const [key,message] of Object.entries(messages))if(raw.includes(key))return new Error(message);
  return new Error("İşlemin sonucu alınamadı. Aynı içerikle tekrar deneyebilirsiniz; ikinci takip görevi oluşturulmaz.");
}
