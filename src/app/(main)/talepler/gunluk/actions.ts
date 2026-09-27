"use server";
import {previewLocationImport,type LocationImportPreview} from "@/lib/operations/location-import-preview";
import { buildTaskPrefill, validateTaskPrefillQuery, type TaskPrefill } from "@/lib/operations/task-prefill";
import type {DirectoryPage} from "@/lib/operations/operations-directory";
import type {OperationsChecklist} from "@/lib/operations/operations-checklist";
import type {AttendanceWeek} from "@/lib/operations/weekly-attendance";
import type { WeeklyPlan } from "@/lib/operations/weekly-plan";
import type { CommandResolution } from "@/lib/operations/command-reconciliation";
import type { CommandScope } from "@/lib/operations/pending-commands";
import { isUuid } from "@/lib/operations/pilot-validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runLocationUpdate,runDirectoryActivation,loadOperationsDirectory,loadOperationsChecklist,loadAttendanceWeek,runRequestBatch,loadPilotWeek,reconcilePilot,runLocationImport,listPilotCompanies,loadPilotBoard,runPilotCommand,pilotError } from "@/lib/services/daily-operations";
import type { PilotKind,PilotBoard,PilotCompany,PilotResult } from "@/lib/operations/pilot-types";

async function context() {
  if(process.env.BPS_DAILY_OPERATIONS_ENABLED!=="true") throw new Error("OPS_FORBIDDEN");
  const client=await createServerSupabaseClient(12_000);
  const {data,error}=await client.auth.getUser();
  if(error) throw error;
  if(!data.user) throw new Error("OPS_UNAUTHENTICATED");
  const role=await client.rpc("current_user_role");
  if(role.error) throw role.error;
  if(role.data!=="yonetici"&&role.data!=="operasyon") throw new Error("OPS_FORBIDDEN");
  return client;
}
export async function pilotCompaniesAction():Promise<PilotResult<PilotCompany[]>> {
  try{return {ok:true,data:await listPilotCompanies(await context())};}catch(e){return {ok:false,message:pilotError(e)};}
}
export async function pilotTaskPrefillAction(query:unknown):Promise<PilotResult<TaskPrefill>> {
  try {
    const q=validateTaskPrefillQuery(query);
    const client=await context();
    const companies=await listPilotCompanies(client);
    const board=await loadPilotBoard(client,q.companyId,q.date);
    return {ok:true,data:buildTaskPrefill(q,companies,board)};
  } catch(e) {return {ok:false,message:pilotError(e,"Talep bağlamı doğrulanamadı. Yeniden deneyin.")};}
}
export async function pilotBoardAction(companyId:string,date:string):Promise<PilotResult<PilotBoard>> {
  try{const client=await context();const board=await loadPilotBoard(client,companyId,date);
    const result=await client.rpc('ops_idp_list',{p_company_id:companyId,p_work_date:date});if(result.error||!Array.isArray(result.data))throw Error('İDP bilgileri okunamadı.');
    const {parseIdpContext}=await import('@/lib/operations/idp-context');const rows=result.data.map(parseIdpContext);
    const byRequest=new Map(rows.map(r=>[r.request_id,r]));
    if(byRequest.size!==rows.length)throw Error('IDP_RESPONSE');
    return {ok:true,data:{...board,requests:board.requests.map(r=>({...r,idp:byRequest.get(r.id)??null}))}};
  }catch(e){return {ok:false,message:pilotError(e)};}
}
export async function pilotCommandAction(id:string,kind:PilotKind,payload:unknown,scope:CommandScope):Promise<PilotResult<{id:string;commandId:string}>> {
  try{return {ok:true,data:await runPilotCommand(await context(),id,kind,payload,checkedScope(scope))};}catch(e){return {ok:false,message:pilotError(e)};}
}

export async function pilotImportAction(commandId:string,companyId:string,rows:unknown,scope:CommandScope):Promise<PilotResult<{added:number;skipped:number}>> {
  try{return {ok:true,data:await runLocationImport(await context(),commandId,companyId,rows,checkedScope(scope))};}catch(e){return {ok:false,message:pilotError(e)};}
}

function checkedScope(scope:CommandScope):CommandScope {
  if(!scope||!isUuid(scope.actorId)||!isUuid(scope.tenantId))throw new Error("OPS_SCOPE_CHANGED");
  return {actorId:scope.actorId,tenantId:scope.tenantId};
}
export async function pilotScopeAction():Promise<PilotResult<CommandScope>> {
  try {
    const client=await context();
    const auth=await client.auth.getUser();
    const tenant=await client.rpc("current_user_verified_tenant");
    if(auth.error)throw auth.error;
    if(tenant.error)throw tenant.error;
    if(!auth.data.user||!tenant.data)throw new Error("OPS_FORBIDDEN");
    return {ok:true,data:checkedScope({actorId:auth.data.user.id,tenantId:tenant.data})};
  }catch(e){return {ok:false,message:pilotError(e)};}
}

export async function pilotReconcileAction(scope:CommandScope,ids:string[],close:boolean):Promise<PilotResult<CommandResolution[]>>{
  try{return {ok:true,data:await reconcilePilot(await context(),checkedScope(scope),ids,close)};}catch(e){return {ok:false,message:pilotError(e)};}
}

export async function pilotWeekAction(companyId:string,date:string):Promise<PilotResult<WeeklyPlan>>{
  try{return {ok:true,data:await loadPilotWeek(await context(),companyId,date)};}catch(e){return {ok:false,message:pilotError(e,"Haftalık plan doğrulanamadı. Bağlantıyı kontrol edip Yenile düğmesini kullanın.")};}
}

export async function pilotRequestBatchAction(scope:CommandScope,id:string,payload:unknown):Promise<PilotResult<{commandId:string;created:number;requestIds:string[]}>>{
  try{return {ok:true,data:await runRequestBatch(await context(),checkedScope(scope),id,payload)};}catch(e){return {ok:false,message:pilotError(e)};}
}

export async function pilotAttendanceWeekAction(companyId:string,date:string):Promise<PilotResult<AttendanceWeek>>{
  try{return {ok:true,data:await loadAttendanceWeek(await context(),companyId,date)};}catch(e){return {ok:false,message:pilotError(e,"Haftalık yoklama özeti alınamadı. Yeniden deneyin.")};}
}

export async function pilotChecklistAction(companyId:string,date:string):Promise<PilotResult<OperationsChecklist>>{
  try{return {ok:true,data:await loadOperationsChecklist(await context(),companyId,date)};}catch(e){return {ok:false,message:pilotError(e,"Operasyon kontrol listesi doğrulanamadı. Yeniden deneyin.")};}
}

export async function pilotDirectoryAction(query:unknown):Promise<PilotResult<DirectoryPage>>{
  try{return {ok:true,data:await loadOperationsDirectory(await context(),query)};}catch(e){return {ok:false,message:pilotError(e,"Dizin doğrulanamadı. Yeniden deneyin.")};}
}

export async function pilotDirectoryActivationAction(scope:CommandScope,id:string,payload:unknown):Promise<PilotResult<{id:string;commandId:string}>>{
  try{return {ok:true,data:await runDirectoryActivation(await context(),checkedScope(scope),id,payload)};}catch(e){return {ok:false,message:pilotError(e)};}
}

export async function pilotImportPreviewAction(companyId:string,rows:unknown,scope:CommandScope):Promise<PilotResult<LocationImportPreview>>{
  try{
    const expected=checkedScope(scope),client=await context();
    async function checkScope(){
      const [auth,tenant]=await Promise.all([client.auth.getUser(),client.rpc("current_user_verified_tenant")]);
      if(auth.error||tenant.error||auth.data.user?.id!==expected.actorId||tenant.data!==expected.tenantId)throw new Error("OPS_SCOPE_CHANGED");
    }
    await checkScope();
    const data=await previewLocationImport(companyId,rows,q=>loadOperationsDirectory(client,q));
    await checkScope();
    return {ok:true,data};
  }catch(e){return {ok:false,message:pilotError(e,"Şube karşılaştırması tamamlanamadı. Yeniden karşılaştırın; eksik sonuçla aktarım yapılamaz.")};}
}

export async function pilotLocationUpdateAction(scope:CommandScope,id:string,payload:unknown):Promise<PilotResult<{id:string;commandId:string}>>{
  try{return {ok:true,data:await runLocationUpdate(await context(),checkedScope(scope),id,payload)};}catch(e){return {ok:false,message:pilotError(e)};}
}

// Kept disabled until the outreach migration and UI recovery acceptance are complete.
export async function outreachLatestAction(scope:CommandScope,assignmentId:string,workerId:string) {
  if(process.env.BPS_REPLACEMENT_OUTREACH_ENABLED!=="true")throw new Error("Yedek görüşme kayıtları henüz kullanıma açılmadı.");
  const {loadOutreachLatest}=await import("@/lib/services/replacement-outreach");
  const client=await context();
  return loadOutreachLatest(client as unknown as import("@/lib/services/replacement-outreach").OutreachClient,checkedScope(scope),assignmentId,workerId);
}
export async function outreachRecordAction(scope:CommandScope,commandId:string,input:unknown) {
  if(process.env.BPS_REPLACEMENT_OUTREACH_ENABLED!=="true")throw new Error("Yedek görüşme kayıtları henüz kullanıma açılmadı.");
  const {recordOutreach}=await import("@/lib/services/replacement-outreach");
  const client=await context();
  return recordOutreach(client as unknown as import("@/lib/services/replacement-outreach").OutreachClient,checkedScope(scope),commandId,input);
}


export async function workReadAction(scope:CommandScope,assignmentId:string) {
  if(process.env.BPS_WORK_APPROVAL_ENABLED!=="true")throw new Error("Çalışma onayı henüz kullanıma açılmadı.");
  const {loadWorkRecord}=await import("@/lib/services/work-approval");
  return loadWorkRecord(await context() as unknown as import("@/lib/services/replacement-outreach").OutreachClient,checkedScope(scope),assignmentId);
}
export async function workExecuteAction(scope:CommandScope,commandId:string,assignmentId:string,revision:number,action:import("@/lib/operations/work-approval").WorkAction,payload:unknown) {
  try {
    if(process.env.BPS_WORK_APPROVAL_ENABLED!=="true")throw new Error("WORK_DISABLED");
    const {executeWorkRecord}=await import("@/lib/services/work-approval");
    return {ok:true as const,data:await executeWorkRecord(await context() as unknown as import("@/lib/services/replacement-outreach").OutreachClient,checkedScope(scope),commandId,assignmentId,revision,action,payload)};
  } catch(error) {
    const {workError}=await import("@/lib/operations/work-approval");
    return {ok:false as const,message:workError(error)};
  }
}

export async function workListAction(scope:CommandScope,companyId:string,workDate:string) {
 if(process.env.BPS_WORK_APPROVAL_ENABLED!=="true")throw new Error("Çalışma onayı henüz kullanıma açılmadı.");
 const {loadWorkList}=await import("@/lib/services/work-approval");
 return loadWorkList(await context() as unknown as import("@/lib/services/replacement-outreach").OutreachClient,checkedScope(scope),companyId,workDate);
}

export async function idpSaveAction(scope:CommandScope,input:import('@/lib/operations/idp-context').IdpInput){
 try{const client=await context(),s=checkedScope(scope);const {validateIdpInput,parseIdpContext}=await import('@/lib/operations/idp-context');const v=validateIdpInput(input);
 const r=await client.rpc('ops_idp_save',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_command_id:v.commandId,p_request_id:v.requestId,p_expected_revision:v.expectedRevision,p_original_name:v.originalName,p_leave_start:v.leaveStart,p_leave_end:v.leaveEnd});if(r.error)throw r.error;
 const row=parseIdpContext(r.data);if(row.tenant_id!==s.tenantId||row.request_id!==v.requestId||row.revision!==v.expectedRevision+1||row.original_name!==v.originalName||row.leave_start!==v.leaveStart||row.leave_end!==v.leaveEnd)throw Error('IDP_RESPONSE');
 return {ok:true as const,data:row};}catch{return {ok:false as const,message:'İDP bilgisi kaydedilemedi veya sonuç doğrulanamadı. Günün izin aralığında, talebin aktif ve tek kişilik olduğunu kontrol edin. Kayıt değiştiyse listeyi yenileyin; belirsiz sonuçta aynı işlemle yeniden deneyin.'};}
}

export async function idpPeriodReadAction(scope:CommandScope,periodId:string){
 try{const c=await context(),s=checkedScope(scope);if(!/^[0-9a-f-]{36}$/i.test(periodId))throw Error('OPS_VALIDATION');
 const r=await c.rpc('ops_idp_period_read',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_period_id:periodId});if(r.error)throw r.error;
 const {parseIdpPeriod}=await import('@/lib/operations/idp-period');return {ok:true as const,data:parseIdpPeriod(r.data)};
 }catch{return {ok:false as const,message:'İDP dönemi okunamadı. Yeniden deneyin.'};}
}

export async function idpPeriodManageAction(scope:CommandScope,input:import('@/lib/operations/idp-period-management').PeriodCommand){
 try{const c=await context(),s=checkedScope(scope);const {validatePeriodCommand,parsePeriodReceipt}=await import('@/lib/operations/idp-period-management');const v=validatePeriodCommand(input);
 const r=await c.rpc('ops_idp_period_manage',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_command_id:v.commandId,p_period_id:v.periodId,p_expected_revision:v.expectedRevision,p_payload:v.change});if(r.error)throw r.error;
 return {ok:true as const,data:parsePeriodReceipt(r.data,v)};
 }catch(e){const raw=e&&typeof e==='object'&&'message' in e?String(e.message):'';
 const message=raw.includes('IDP_PERIOD_ASSIGNED')?'Dönemde atanmış personel var. Önce ilgili günlerdeki atamaları, yoklama ve onay durumlarını kontrol ederek kaldırın.':raw.includes('IDP_PERIOD_DATES')?'Mevcut çalışma günleri yeni izin aralığında kalmalı. Eklenecek gün daha önce döneme eklenmiş olamaz.':raw.includes('IDP_PERIOD_CANCELLED')?'Bu dönem iptal edilmiş; yeniden düzenlenemez.':pilotError(e,'Dönem işlemi doğrulanamadı. Aynı işlemi yeniden deneyin veya listeyi yenileyin.');
 return {ok:false as const,message};}
}

export async function idpPeriodHistoryAction(scope:CommandScope,periodId:string,before?:number){
 try{const c=await context(),s=checkedScope(scope);const {isUuid}=await import('@/lib/operations/pilot-validation');if(!isUuid(periodId)||before!==undefined&&(!Number.isInteger(before)||before<1))throw Error('OPS_VALIDATION');
 const r=await c.rpc('ops_idp_period_history',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_period_id:periodId,...(before===undefined?{}:{p_before_revision:before})}).abortSignal(AbortSignal.timeout(12_000));if(r.error)throw r.error;
 const {parseIdpHistory}=await import('@/lib/operations/idp-history');return {ok:true as const,data:parseIdpHistory(r.data,s,periodId,before)};
 }catch{return {ok:false as const,message:'Dönem geçmişi okunamadı. Yeniden deneyin.'};}
}

export async function pilotTimedRequestsAction(scope:CommandScope,id:string,payload:unknown):Promise<PilotResult<{commandId:string;created:number;requestIds:string[]}>>{
 try{
  if(process.env.BPS_SHIFT_SCHEDULING_ENABLED!=='true')throw Error('OPS_FORBIDDEN');
  const {createTimedRequests}=await import('@/lib/services/timed-requests');
  const receipt=await createTimedRequests(await context(),checkedScope(scope),id,payload);
  return {ok:true,data:{commandId:receipt.commandId,created:receipt.rows.length,requestIds:receipt.rows.map(r=>r.id)}};
 }catch(e){return {ok:false,message:pilotError(e)};}
}
