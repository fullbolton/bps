import {isUuid} from '@/lib/operations/pilot-validation';
import {parseManagedMemberships,type ManagedMembership} from './workspace-memberships';
import {resolveWorkspaceAccess} from './auth-workspace';
export type WorkspaceChoices={userId:string;selectionVersion:string|null;activeTenantId:string|null;memberships:ManagedMembership[]};
export type SelectionCommand={userId:string;tenantId:string;membershipVersion:string;commandId:string;expectedVersion:string|null};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseWorkspaceChoices(value:unknown,userId:string):WorkspaceChoices{
 if(!record(value)||!(value.selectionVersion===null||isUuid(value.selectionVersion))||!(value.activeTenantId===null||isUuid(value.activeTenantId)))throw Error('WORKSPACE_RESPONSE');
 const memberships=parseManagedMemberships(value,userId);
 if(value.activeTenantId!==null&&!memberships.some(m=>m.tenantId===value.activeTenantId))throw Error('WORKSPACE_RESPONSE');
 return {userId,selectionVersion:value.selectionVersion,activeTenantId:value.activeTenantId,memberships};
}
export function selectionArgs(command:SelectionCommand){
 if(![command.userId,command.tenantId,command.membershipVersion,command.commandId].every(isUuid)||!(command.expectedVersion===null||isUuid(command.expectedVersion)))throw Error('WORKSPACE_INPUT');
 return {p_tenant_id:command.tenantId,p_membership_version:command.membershipVersion,p_command_id:command.commandId,p_expected_version:command.expectedVersion};
}
export function parseSelectionReceipt(value:unknown,command:SelectionCommand){
 if(!record(value)||value.userId!==command.userId||value.tenantId!==command.tenantId||value.membershipVersion!==command.membershipVersion||!isUuid(value.selectionVersion))throw Error('WORKSPACE_RECEIPT');
 return {userId:command.userId,tenantId:command.tenantId,selectionVersion:value.selectionVersion,membershipVersion:command.membershipVersion};
}
/** A successful write alone never authorizes navigation. Refresh and DB verification are required. */
export async function completeWorkspaceSwitch(command:SelectionCommand,io:{select:(args:ReturnType<typeof selectionArgs>)=>Promise<unknown>;refresh:()=>Promise<{id:string;app_metadata:Record<string,unknown>}|null>;context:()=>Promise<unknown>}){
 const receipt=parseSelectionReceipt(await io.select(selectionArgs(command)),command);
 const user=await io.refresh();
 if(!user||user.id!==command.userId)throw Error('WORKSPACE_SESSION_CHANGED');
 const context=await io.context();
 const access=resolveWorkspaceAccess(user,context);
 if(!record(context)||context.selectionVersion!==receipt.selectionVersion||context.membershipVersion!==receipt.membershipVersion||access.user?.app_metadata.active_tenant!==receipt.tenantId)throw Error('WORKSPACE_REFRESH_UNVERIFIED');
 return receipt;
}
