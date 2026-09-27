import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {checkTalentScope} from '@/lib/talent/people';
import {importChangeTarget,parseImportChangeReview} from '@/lib/talent/import-undo';
export async function reviewImportUpdate(c:SupabaseClient<Database>,scope:unknown,batchId:unknown,number:unknown,undo=false){
 if(typeof undo!=='boolean')throw Error('TALENT_IMPORT_VALIDATION');
 const s=checkTalentScope(scope),t=importChangeTarget(batchId,number);
 const {data,error}=await c.rpc(undo?'talent_import_undo_update':'talent_import_change_review',{p_actor:s.actorId,p_tenant:s.tenantId,p_batch:t.batchId,p_number:t.number});
 if(error)throw error;return parseImportChangeReview(data,s,t.batchId,t.number);
}
