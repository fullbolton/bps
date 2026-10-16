"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteContractScoped } from "@/lib/supabase/contracts";

export type ContractDeleteResult =
  | { ok: true; deletedName: string }
  | { ok: false; error: string };

/** Delete only the revision explicitly confirmed by the user; DB owns role,
 * module, membership and retained-history checks. Missing rows are not success. */
export async function deleteContractAction(contractId: string, expectedRevision: number): Promise<ContractDeleteResult> {
  if(typeof contractId!=="string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contractId)
    || !Number.isSafeInteger(expectedRevision) || expectedRevision<0) {
    return {ok:false,error:"Sözleşme veya sürüm bilgisi geçersiz. Sayfayı yenileyin."};
  }
  const supabase=await createServerSupabaseClient();
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError || !user)return {ok:false,error:"Oturum doğrulanamadı. Yeniden giriş yapın."};
  const {data:tenant,error}=await supabase.rpc("current_user_verified_tenant");
  if(error || typeof tenant!=="string" || !tenant)return {ok:false,error:"Çalışma alanı doğrulanamadı. Sayfayı yenileyin."};
  try {
    const row=await deleteContractScoped(supabase,contractId,{tenant_id:tenant,revision:expectedRevision});
    return {ok:true,deletedName:row.name};
  }catch(error){return {ok:false,error:error instanceof Error?error.message:"Silme işleminin sonucu doğrulanamadı. Listeyi yenileyin."};}
}
