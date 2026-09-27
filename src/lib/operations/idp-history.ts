import {isUuid} from './pilot-validation';
import {isWorkDate} from './daily-demand';
import type {CommandScope} from './pending-commands';
export type IdpHistoryItem={id:string;revision:number;at:string;actorName:string;action:'created'|'update'|'cancel';reason:string|null;originalName:string|null;leaveStart:string|null;leaveEnd:string|null;added:number;cancelled:number};
export type IdpHistoryPage={items:IdpHistoryItem[];hasMore:boolean};
export function parseIdpHistory(value:unknown,scope:CommandScope,periodId:string,before?:number):IdpHistoryPage{
 const bad=():never=>{throw Error('IDP_HISTORY_RESPONSE');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();const v=value as Record<string,unknown>;
 if(v.actorId!==scope.actorId||v.tenantId!==scope.tenantId||v.periodId!==periodId||!Array.isArray(v.items)||v.items.length>50||typeof v.hasMore!=='boolean'||v.hasMore&&v.items.length!==50)return bad();
 let last=before??2147483648;const ids=new Set<string>();
 const items=v.items.map((raw:unknown)=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return bad();const r=raw as IdpHistoryItem;
  if(!isUuid(r.id)||ids.has(r.id)||!Number.isInteger(r.revision)||r.revision<1||r.revision>=last||typeof r.at!=='string'||!Number.isFinite(Date.parse(r.at))||typeof r.actorName!=='string'||!r.actorName.trim()||!['created','update','cancel'].includes(r.action)||!Number.isInteger(r.added)||r.added<0||r.added>31||!Number.isInteger(r.cancelled)||r.cancelled<0||r.cancelled>31)return bad();
  if(r.action==='created'?r.revision!==1||r.reason!==null:typeof r.reason!=='string'||r.reason.trim().length<3)return bad();
  if(r.action!=='cancel'&&(typeof r.originalName!=='string'||!r.originalName.trim()||!isWorkDate(r.leaveStart)||!isWorkDate(r.leaveEnd)||r.leaveStart!>r.leaveEnd!))return bad();
  ids.add(r.id);last=r.revision;
  return {id:r.id,revision:r.revision,at:r.at,actorName:r.actorName,action:r.action,reason:r.reason,originalName:r.originalName,leaveStart:r.leaveStart,leaveEnd:r.leaveEnd,added:r.added,cancelled:r.cancelled};
 });return {items,hasMore:v.hasMore};
}
