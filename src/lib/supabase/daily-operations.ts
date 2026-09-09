import type {DirectoryQuery,DirectoryActivation} from "@/lib/operations/operations-directory";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
type Client = SupabaseClient<Database>;

export async function selectPilotCompanies(client: Client) {
  const tenant=await client.rpc("current_user_verified_tenant");
  if(tenant.error)throw tenant.error;
  if(typeof tenant.data!=="string"||!tenant.data)throw new Error("OPS_FORBIDDEN");
  const { data,error }=await client.from("companies").select("id,name,status").eq("tenant_id",tenant.data).order("name");
  if(error) throw error;
  return data;
}
export async function selectPilotBoard(client: Client, companyId:string, workDate:string) {
  const {data,error}=await client.rpc("ops_board",{p_company_id:companyId,p_work_date:workDate});
  if(error) throw error;
  return data;
}
export async function mutatePilot(client: Client, commandId:string,kind:string,payload:Json) {
  const {data,error}=await client.rpc("ops_mutate",{p_command_id:commandId,p_kind:kind,p_payload:payload});
  if(error) throw error;
  return data;
}

export async function importPilotLocations(client:Client,commandId:string,companyId:string,rows:Json) {
  const {data,error}=await client.rpc("ops_import_locations",{p_command_id:commandId,p_company_id:companyId,p_rows:rows});
  if(error)throw error;
  return data;
}

export async function executeScopedPilot(client:Client,actorId:string,tenantId:string,commandId:string,kind:string,payload:Json){
  const {data,error}=await client.rpc("ops_execute_scoped",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:commandId,p_kind:kind,p_payload:payload});
  if(error)throw error;
  return data;
}

export async function reconcilePilotCommands(client:Client,actorId:string,tenantId:string,ids:string[],close:boolean){
  const {data,error}=await client.rpc("ops_reconcile_commands",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_ids:ids,p_close:close});
  if(error)throw error;
  return data;
}

export async function selectPilotWeek(client:Client,companyId:string,start:string){
  const {data,error}=await client.rpc("ops_week",{p_company_id:companyId,p_week_start:start});
  if(error)throw error;
  return data;
}

export async function createPilotRequestBatch(client:Client,actorId:string,tenantId:string,id:string,payload:Json){
  const {data,error}=await client.rpc("ops_create_request_batch",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_payload:payload});
  if(error)throw error;
  return data;
}

export async function resizePilotRequest(client:Client,actorId:string,tenantId:string,id:string,requestId:string,expected:number,required:number){
  const {data,error}=await client.rpc("ops_resize_request",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_request_id:requestId,p_expected_count:expected,p_required_count:required});
  if(error)throw error;
  return data;
}

export async function recordPilotAttendance(client:Client,actorId:string,tenantId:string,id:string,assignmentId:string,expected:number,status:string){
  const {data,error}=await client.rpc("ops_record_attendance",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_assignment_id:assignmentId,p_expected_revision:expected,p_status:status});
  if(error)throw error;
  return data;
}

export async function replacePilotAssignment(client:Client,actorId:string,tenantId:string,id:string,assignmentId:string,workerId:string,expected:number){
  const {data,error}=await client.rpc("ops_replace_assignment",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_assignment_id:assignmentId,p_worker_id:workerId,p_expected_revision:expected});
  if(error)throw error;
  return data;
}

export async function selectAttendanceWeek(client:Client,companyId:string,start:string){
  const {data,error}=await client.rpc("ops_attendance_week",{p_company_id:companyId,p_week_start:start});
  if(error)throw error;
  return data;
}

export async function selectOperationsDirectory(client:Client,q:DirectoryQuery){
  const {data,error}=await client.rpc("ops_directory",{p_kind:q.kind,p_company_id:q.companyId,p_search:q.search,p_status:q.status,p_offset:q.offset});
  if(error)throw error;
  return data;
}

export async function setDirectoryActive(client:Client,actorId:string,tenantId:string,id:string,p:DirectoryActivation){
  const {data,error}=await client.rpc("ops_set_directory_active",{p_actor_id:actorId,p_tenant_id:tenantId,p_command_id:id,p_kind:p.kind,p_entity_id:p.id,p_expected_revision:p.expectedRevision,p_active:p.active});
  if(error)throw error;
  return data;
}
