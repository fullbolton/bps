import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import type {TalentScope,PeopleQuery,SavePerson} from '@/lib/talent/people';
type Client=SupabaseClient<Database>;
export async function resolveTalentCommand(c:Client,s:TalentScope,id:string){
 const {data,error}=await c.rpc('talent_resolve_person_command',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_command_id:id});
 if(error)throw error;return data;
}
export async function selectTalentPage(c:Client,s:TalentScope,q:PeopleQuery){
 const {data,error}=await c.rpc('talent_people_page',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_query:{...q}});
 if(error)throw error;return data;
}
export async function selectTalentDetail(c:Client,s:TalentScope,id:string){
 const {data,error}=await c.rpc('talent_person_detail',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_person_id:id});
 if(error)throw error;return data;
}
export async function saveTalentPerson(c:Client,s:TalentScope,x:SavePerson){
 const {data,error}=await c.rpc('talent_save_person',{p_actor_id:s.actorId,p_tenant_id:s.tenantId,p_command_id:x.commandId,p_person_id:x.personId,p_expected_revision:x.expectedRevision,p_input:{...x.input,contacts:x.input.contacts.map(c=>({...c}))}});
 if(error)throw error;return data;
}

export async function selectTalentCompareSnapshot(c:Client,s:TalentScope){
 const {data,error}=await c.rpc('talent_compare_snapshot',{p_actor_id:s.actorId,p_tenant_id:s.tenantId});
 if(error)throw error;return data;
}
