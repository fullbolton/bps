import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {checkTalentScope} from '@/lib/talent/people';
import {mergePair,parseMergeReview,validateMergeCommand,parseMergeReceipt,parseMergeResolution} from '@/lib/talent/merge-review';
export async function reviewPersonMerge(c:SupabaseClient<Database>,scope:unknown,left:unknown,right:unknown){
 const s=checkTalentScope(scope),pair=mergePair(left,right);
 const {data,error}=await c.rpc('talent_merge_review',{p_actor:s.actorId,p_tenant:s.tenantId,p_left:pair.left,p_right:pair.right});
 if(error)throw error;
 return parseMergeReview(data,s,pair.left,pair.right);
}

export async function applyPersonMerge(c:SupabaseClient<Database>,scope:unknown,input:unknown){
 const s=checkTalentScope(scope),x=validateMergeCommand(input);
 const {data,error}=await c.rpc('talent_merge_apply',{p_actor:s.actorId,p_tenant:s.tenantId,p_command:x.commandId,p_left:x.leftId,p_right:x.rightId,p_primary:x.primaryId,p_review_token:x.reviewToken,p_fields:x.fields,p_confirm_same_person:x.confirmSamePerson,p_keep_primary_availability:x.keepPrimaryAvailability});
 if(error)throw error;return parseMergeReceipt(data,s,x);
}
export async function resolvePersonMerge(c:SupabaseClient<Database>,scope:unknown,input:unknown){
 const s=checkTalentScope(scope),x=validateMergeCommand(input);
 const {data,error}=await c.rpc('talent_merge_resolve',{p_actor:s.actorId,p_tenant:s.tenantId,p_command:x.commandId});
 if(error)throw error;return parseMergeResolution(data,s,x);
}
