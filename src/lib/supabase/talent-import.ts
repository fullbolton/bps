import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database,Json} from '@/types/database.types';
import type {TalentScope} from '@/lib/talent/people';
import type {ImportRequest} from '@/lib/talent/import-batches';
type Client=SupabaseClient<Database>;
export async function prepareImport(c:Client,s:TalentScope,r:ImportRequest){
 const {data,error}=await c.rpc('talent_import_prepare',{p_actor:s.actorId,p_tenant:s.tenantId,p_batch:r.batchId,p_source_hash:r.sourceHash,p_rows:r.rows as unknown as Json});if(error)throw error;return data;
}
export async function readImport(c:Client,s:TalentScope,id:string){
 const {data,error}=await c.rpc('talent_import_status',{p_actor:s.actorId,p_tenant:s.tenantId,p_batch:id});if(error)throw error;return data;
}
export async function applyImportRow(c:Client,s:TalentScope,id:string,number:number){
 const {data,error}=await c.rpc('talent_import_apply_row',{p_actor:s.actorId,p_tenant:s.tenantId,p_batch:id,p_number:number});if(error)throw error;return data;
}
export async function cancelImport(c:Client,s:TalentScope,id:string){
 const {data,error}=await c.rpc('talent_import_cancel',{p_actor:s.actorId,p_tenant:s.tenantId,p_batch:id});if(error)throw error;return data;
}
export async function recoverImport(c:Client,s:TalentScope,r:import('@/lib/talent/import-batches').ImportReference,close=false){
 const args={p_actor:s.actorId,p_tenant:s.tenantId,p_batch:r.batchId,p_source_hash:r.sourceHash,p_total:r.total};
 const {data,error}=await c.rpc(close?'talent_import_close':'talent_import_recover',args);if(error)throw error;return data;
}
export async function readImportHistory(c:Client,s:TalentScope,offset:number){const {data,error}=await c.rpc('talent_import_history',{p_actor:s.actorId,p_tenant:s.tenantId,p_offset:offset});if(error)throw error;return data;}
