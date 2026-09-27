import { isUuid } from './pilot-validation';
export type ConversationPerson={id:string;name:string};
export type ConversationMessage={id:string;author_id:string;body:string;parent_id:string|null;mention_ids:string[];created_at:string};
export type InboxItem={message_id:string;request_id:string;company_id:string;company_name:string;work_date:string;body:string;created_at:string;read_at:string|null};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const stamp=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const fail=():never=>{throw Error('COMM_RESPONSE');};
export function parsePeople(v:unknown):ConversationPerson[]{
 if(!Array.isArray(v)||v.some(x=>!record(x)||!isUuid(x.id)||typeof x.name!=='string'))return fail();return v;
}
export function parseMessages(v:unknown):ConversationMessage[]{
 if(!Array.isArray(v)||v.length>30||v.some(x=>!record(x)||!isUuid(x.id)||!isUuid(x.author_id)||typeof x.body!=='string'||!stamp(x.created_at)||(x.parent_id!==null&&!isUuid(x.parent_id))||!Array.isArray(x.mention_ids)||x.mention_ids.some(id=>!isUuid(id))))return fail();return v;
}
export function parseInbox(v:unknown):{unread:number;items:InboxItem[]}{
 if(!record(v)||typeof v.unread!=='number'||!Number.isSafeInteger(v.unread)||v.unread<0||!Array.isArray(v.items)||v.items.length>30)return fail();
 if(v.items.some(x=>!record(x)||!isUuid(x.message_id)||!isUuid(x.request_id)||!isUuid(x.company_id)||typeof x.company_name!=='string'||typeof x.body!=='string'||typeof x.work_date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.work_date)||!stamp(x.created_at)||(x.read_at!==null&&!stamp(x.read_at))))return fail();
 return {unread:v.unread,items:v.items};
}
