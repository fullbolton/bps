import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {workspaceRoles,type WorkspaceRole} from '@/lib/auth-workspace';
import {readNotificationPages} from './read-pages';
import {fetchCompanyPartnerAssignments,type RecipientRow} from './notification-recipients';
type Membership={tenant_id:string;user_id:string;role:WorkspaceRole;version:string};
type Contact={id:string;email:string|null;display_name:string|null};
export function tenantRoleDirectory(memberships:Membership[],contacts:Contact[]){
 const byTenant=new Map<string,Map<string,Membership>>(),people=new Map(contacts.map(p=>[p.id,p]));
 for(const m of memberships){
  if(!m.tenant_id||!m.user_id||!m.version||!workspaceRoles.includes(m.role))throw Error('MEMBERSHIP_INVALID');
  const map=byTenant.get(m.tenant_id)??new Map<string,Membership>();if(map.has(m.user_id))throw Error('MEMBERSHIP_DUPLICATE');map.set(m.user_id,m);byTenant.set(m.tenant_id,map);
 }
 return {
  member:(tenant:string,id:string)=>byTenant.get(tenant)?.get(id),
  recipients(tenant:string,roles:readonly string[],requireName=true):RecipientRow[]{
   return [...(byTenant.get(tenant)?.values()??[])].flatMap(m=>{
    const p=people.get(m.user_id);return roles.includes(m.role)&&p?.email&&(!requireName||p.display_name)?[{id:p.id,email:p.email,display_name:p.display_name??'',role:m.role}]:[];
   });
  }
 };
}
export type TenantRoleDirectory=ReturnType<typeof tenantRoleDirectory>;
export async function readTenantRoleDirectory(client:SupabaseClient<Database>):Promise<TenantRoleDirectory>{
 const memberships=await readNotificationPages((from,to)=>client.from('tenant_memberships').select('tenant_id,user_id,role,version',{count:'exact'}).order('tenant_id').order('user_id').range(from,to),
  row=>typeof row.tenant_id==='string'&&typeof row.user_id==='string'&&typeof row.version==='string'&&workspaceRoles.includes(row.role as WorkspaceRole)?JSON.stringify([row.tenant_id,row.user_id]):null);
 const ids=[...new Set(memberships.map(m=>m.user_id))],contacts:Contact[]=[];
 for(let offset=0;offset<ids.length;offset+=100){
  const chunk=ids.slice(offset,offset+100);
  const rows=await readNotificationPages((from,to)=>client.from('profiles').select('id,email,display_name',{count:'exact'}).in('id',chunk).order('id').range(from,to),row=>chunk.includes(row.id)?row.id:null);
  contacts.push(...rows);
 }
 return tenantRoleDirectory(memberships as Membership[],contacts);
}
/** Require unchanged role and membership generation before dispatch; no profile.role fallback. */
export function sameRecipientMembership(before:TenantRoleDirectory,after:TenantRoleDirectory,tenant:string,id:string){
 const a=before.member(tenant,id),b=after.member(tenant,id);return !!a&&!!b&&a.role===b.role&&a.version===b.version;
}
export async function tenantCompanyRecipients(client:SupabaseClient<Database>,directory:TenantRoleDirectory,companies:{companyId:string;tenantId:string}[],includePartners:boolean,requireName=true){
 const tenants=new Map<string,string>();for(const c of companies){if(tenants.has(c.companyId)&&tenants.get(c.companyId)!==c.tenantId)throw Error('COMPANY_TENANT_CONFLICT');tenants.set(c.companyId,c.tenantId);}
 const assignments=includePartners?await fetchCompanyPartnerAssignments(client,[...tenants.keys()]):{rows:[]};if(assignments.error)throw Error('ASSIGNMENTS_INCOMPLETE');
 const result=new Map<string,RecipientRow[]>();
 for(const [company,tenant] of tenants){
  const assigned=new Set(assignments.rows.filter(a=>a.company_id===company).map(a=>a.partner_user_id));
  result.set(company,[...directory.recipients(tenant,['yonetici'],requireName),...directory.recipients(tenant,['partner'],requireName).filter(p=>assigned.has(p.id))]);
 }
 return result;
}
