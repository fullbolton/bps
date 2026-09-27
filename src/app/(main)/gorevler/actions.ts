"use server";

/** Creates company-linked or independent tasks in the current verified workspace.
 * Company-linked tasks retain the active-company guard; RLS enforces role/assignee scope.
 * Independent tasks use company_id=null and cannot carry a contract/appointment source.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTask,claimTask,completeOperationTask } from "@/lib/services/tasks";
import type { TaskCreateInput } from "@/lib/services/tasks";
import {
  requireCompanyByLegacyMockId,
  assertCompanyIsActiveForNewOperation,
} from "@/lib/services/companies";

export type CreateTaskActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function createTaskAction(
  input: TaskCreateInput,
): Promise<CreateTaskActionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Oturum geçersiz: lütfen tekrar giriş yapın." };
  }
  if (!input || (input.legacyCompanyId !== null && typeof input.legacyCompanyId !== "string")) {
    return { ok: false, error: "Firma kimliği geçersiz." };
  }

  const { data: tenantId, error: tenantError } = await supabase.rpc(
    "current_user_verified_tenant",
  );
  if (tenantError || typeof tenantId !== "string" || tenantId.length === 0) {
    return { ok: false, error: "Aktif kiracı çözümlenemedi." };
  }

  try {
    // Resolve the firma (legacy "f1" or real UUID) so the passive guard
    // runs against the real company id — BEFORE any insert.
    if (input.legacyCompanyId?.trim()) {
    const company = await requireCompanyByLegacyMockId(
      supabase,
      input.legacyCompanyId,
    );
    const activeCheck = await assertCompanyIsActiveForNewOperation(
      supabase,
      company.id,
      tenantId,
    );
    if (!activeCheck.ok) {
      return activeCheck;
    }
    }
    await createTask(supabase, input, { tenantId });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Görev oluşturulamadı.",
    };
  }
}

export async function claimTaskAction(input:{id:string;revision:number;actorId:string;tenantId:string}):Promise<CreateTaskActionResult>{
  try{
    if(!input||![input.id,input.actorId,input.tenantId].every(v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)))throw new Error('Görev veya oturum bilgisi geçersiz.');
    await claimTask(await createServerSupabaseClient(),input.id,input.revision,input.actorId,input.tenantId);
    return {ok:true};
  }catch(e){return {ok:false,error:e instanceof Error?e.message:'İş üstlenilemedi. Listeyi yenileyin.'};}
}

export async function completeTaskAction(input:{id:string;revision:number;actorId:string;tenantId:string}):Promise<CreateTaskActionResult>{
  try {
    if (!input) throw new Error('Görev bilgisi eksik.');
    await completeOperationTask(await createServerSupabaseClient(12_000),input.id,input.revision,input.actorId,input.tenantId);
    return {ok:true};
  } catch(e) { return {ok:false,error:e instanceof Error?e.message:'Görev tamamlanamadı. Listeyi yenileyin.'}; }
}
