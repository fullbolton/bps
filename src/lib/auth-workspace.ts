import {isUuid} from '@/lib/operations/pilot-validation';
/** UI freshness scope only. Never persist this object to Auth or trust user metadata as membership. */
export function withVerifiedWorkspace<T extends {id:string;app_metadata:Record<string,unknown>}>(user:T|null,response:unknown):T|null{
 if(!user)return null;
 const {active_tenant:ignored,...metadata}=user.app_metadata;
 const v=response&&typeof response==='object'&&!Array.isArray(response)?response as Record<string,unknown>:null;
 const tenant=v?.actorId===user.id&&isUuid(v?.tenantId)?v.tenantId:undefined;
 return {...user,app_metadata:tenant?{...metadata,active_tenant:tenant}:metadata};
}

export const workspaceRoles=['yonetici','partner','operasyon','ik','muhasebe','goruntuleyici'] as const;
export type WorkspaceRole=typeof workspaceRoles[number];
/** Accept role and company only together from one authenticated RPC response. */
export function resolveWorkspaceAccess<T extends {id:string;app_metadata:Record<string,unknown>}>(user:T|null,response:unknown):{user:T|null;role:WorkspaceRole}{
 const blocked={user:withVerifiedWorkspace(user,null),role:'goruntuleyici' as const};
 if(!user||!response||typeof response!=='object'||Array.isArray(response))return blocked;
 const v=response as Record<string,unknown>;
 if(v.actorId!==user.id||!isUuid(v.tenantId)||typeof v.name!=='string'||!v.name.trim()||v.name.length>500||/[\u0000-\u001f\u007f]/.test(v.name)||!workspaceRoles.includes(v.role as WorkspaceRole))return blocked;
 return {user:withVerifiedWorkspace(user,v),role:v.role as WorkspaceRole};
}

/** Context generations come from the verified RPC, never from cached JWT metadata. */
export function verifiedWorkspaceGeneration(response:unknown):string|null{
 if(!response||typeof response!=='object'||Array.isArray(response))return null;
 const v=response as Record<string,unknown>;
 if(!(v.selectionVersion===null||isUuid(v.selectionVersion))||!isUuid(v.membershipVersion))return null;
 return `${v.selectionVersion??'initial'}:${v.membershipVersion}`;
}
