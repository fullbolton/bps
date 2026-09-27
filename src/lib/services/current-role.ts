import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {workspaceRoles,type WorkspaceRole} from '@/lib/auth-workspace';

/** The RPC verifies the live company membership; the profile's legacy role is not authority. */
export async function readCurrentRole(client:SupabaseClient<Database>):Promise<WorkspaceRole>{
 const {data,error}=await client.rpc('current_user_role').abortSignal(AbortSignal.timeout(12000));
 if(error||typeof data!=='string'||!workspaceRoles.includes(data as WorkspaceRole)){
  throw new Error('Şirket yetkiniz doğrulanamadı. Sayfayı yenileyip tekrar deneyin.');
 }
 return data as WorkspaceRole;
}
