import {isUuid} from '@/lib/operations/pilot-validation';
import {workspaceRoles,type WorkspaceRole} from '@/lib/auth-workspace';
export type ManagedMembership={tenantId:string;name:string;role:WorkspaceRole;version:string};
export type MembershipCommand={userId:string;tenantId:string;action:'add';role:WorkspaceRole}|{userId:string;tenantId:string;action:'change_role';role:WorkspaceRole;expectedRole:WorkspaceRole;expectedVersion:string}|{userId:string;tenantId:string;action:'remove';expectedRole:WorkspaceRole;expectedVersion:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validRole=(v:unknown):v is WorkspaceRole=>typeof v==='string'&&workspaceRoles.includes(v as WorkspaceRole);
/** New admin UI contract. Not wired to the legacy single-company screen. */
export function parseManagedMemberships(value:unknown,userId:string):ManagedMembership[]{
 if(!isUuid(userId)||!object(value)||value.userId!==userId||!Array.isArray(value.memberships))throw Error('MEMBERSHIP_RESPONSE');
 const seen=new Set<string>();
 return value.memberships.map(v=>{
  if(!object(v)||!isUuid(v.tenantId)||seen.has(v.tenantId)||!isUuid(v.version)||!validRole(v.role)||typeof v.name!=='string'||!v.name.trim()||v.name.length>500||/[\u0000-\u001f\u007f]/.test(v.name))throw Error('MEMBERSHIP_RESPONSE');
  seen.add(v.tenantId);return {tenantId:v.tenantId,name:v.name.trim(),role:v.role,version:v.version};
 });
}
/** Every edit/removal uses the exact generation read by the administrator. */
export function membershipCommandArgs(value:MembershipCommand){
 if(!isUuid(value.userId)||!isUuid(value.tenantId))throw Error('MEMBERSHIP_INPUT');
 if(value.action==='add'){
  if(!validRole(value.role)||'expectedRole' in value||'expectedVersion' in value)throw Error('MEMBERSHIP_INPUT');
  return {p_user_id:value.userId,p_tenant_id:value.tenantId,p_action:value.action,p_role:value.role};
 }
 if((value.action!=='change_role'&&value.action!=='remove')||!validRole(value.expectedRole)||!isUuid(value.expectedVersion))throw Error('MEMBERSHIP_INPUT');
 if(value.action==='change_role'&&!validRole(value.role))throw Error('MEMBERSHIP_INPUT');
 if(value.action==='remove'&&'role' in value)throw Error('MEMBERSHIP_INPUT');
 return {p_user_id:value.userId,p_tenant_id:value.tenantId,p_action:value.action,...(value.action==='change_role'?{p_role:value.role}:{}),p_expected_role:value.expectedRole,p_expected_version:value.expectedVersion};
}
