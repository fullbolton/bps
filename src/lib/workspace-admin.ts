import {isUuid} from '@/lib/operations/pilot-validation';
import type {MembershipCommand} from './workspace-memberships';
export type WorkspaceAdminUser={id:string;name:string;email:string;platformAdmin:boolean;membershipCount:number};
export type WorkspaceAdminPage={offset:number;query:string;total:number;users:WorkspaceAdminUser[]};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
export function parseWorkspaceAdminPage(value:unknown,offset:number,query:string):WorkspaceAdminPage{
 if(!count(offset)||offset>1000000||typeof query!=='string'||query.length>160)throw Error('ADMIN_INPUT');
 if(!record(value)||value.offset!==offset||value.query!==query.trim()||!count(value.total)||!Array.isArray(value.users)||value.users.length>50||value.users.length!==Math.min(50,Math.max(0,value.total-offset)))throw Error('ADMIN_RESPONSE');
 const seen=new Set<string>();
 const users=value.users.map(u=>{
  if(!record(u)||!isUuid(u.id)||seen.has(u.id)||typeof u.name!=='string'||typeof u.email!=='string'||typeof u.platformAdmin!=='boolean'||!count(u.membershipCount))throw Error('ADMIN_RESPONSE');
  seen.add(u.id);return {id:u.id,name:u.name,email:u.email,platformAdmin:u.platformAdmin,membershipCount:u.membershipCount};
 });return {offset,query:query.trim(),total:value.total,users};
}
export function verifyMembershipReceipt(value:unknown,command:MembershipCommand):void{
 if(!record(value)||value.userId!==command.userId||value.tenantId!==command.tenantId||value.action!==command.action||value.role!==(command.action==='remove'?null:command.role))throw Error('MEMBERSHIP_RECEIPT');
}
export function workspaceAdminError(error:unknown):string{
 const code=record(error)?error.code:undefined;
 if(code==='42501')return 'Bu işlem için platform yöneticisi yetkisi gerekiyor.';
 if(code==='BP001')return 'Bu şirkette kişiye atanmış açık görevler var. Önce görevleri devredin.';
 if(code==='40001')return 'Üyelik bilgisi değişmiş. Güncel üyelikleri yükleyip işlemi yeniden seçin.';
 if(code==='23503')return 'Kişi veya şirket artık bulunamıyor. Listeyi yenileyin.';
 return 'İşlem sonucu doğrulanamadı. Yeni işlemden önce güncel üyelikleri yükleyin.';
}
