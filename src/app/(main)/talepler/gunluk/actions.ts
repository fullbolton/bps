"use server";
import { buildTaskPrefill, validateTaskPrefillQuery, type TaskPrefill } from "@/lib/operations/task-prefill";
import type {DirectoryPage} from "@/lib/operations/operations-directory";
import type {OperationsChecklist} from "@/lib/operations/operations-checklist";
import type {AttendanceWeek} from "@/lib/operations/weekly-attendance";
import type { WeeklyPlan } from "@/lib/operations/weekly-plan";
import type { CommandResolution } from "@/lib/operations/command-reconciliation";
import type { CommandScope } from "@/lib/operations/pending-commands";
import { isUuid } from "@/lib/operations/pilot-validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runDirectoryActivation,loadOperationsDirectory,loadOperationsChecklist,loadAttendanceWeek,runRequestBatch,loadPilotWeek,reconcilePilot,runLocationImport,listPilotCompanies,loadPilotBoard,runPilotCommand,pilotError } from "@/lib/services/daily-operations";
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
  try{return {ok:true,data:await loadPilotBoard(await context(),companyId,date)};}catch(e){return {ok:false,message:pilotError(e)};}
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
  try{return {ok:true,data:await loadAttendanceWeek(await context(),companyId,date)};}catch(e){return {ok:false,message:pilotError(e,"Haftalık gerçekleşme doğrulanamadı. Yeniden deneyin.")};}
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
