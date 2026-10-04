import {requireOperationalText} from '@/lib/privacy/operational-text';
import {isUuid} from '@/lib/operations/pilot-validation';
import type {TalentScope} from './people';

export const conversationChannels = {phone:'Telefon',message:'Mesaj',in_person:'Yüz yüze'} as const;
export const conversationOutcomes = {reached:'Görüşüldü',no_answer:'Ulaşılamadı',call_back:'Tekrar aranacak',declined:'İlgili işi istemiyor'} as const;
export type ConversationInput = {commandId:string;personId:string;requestId:string|null;channel:keyof typeof conversationChannels;outcome:keyof typeof conversationOutcomes;note:string};
export type PersonConversation = ConversationInput & {id:string;tenantId:string;actorId:string;recordedAt:string;sourcePersonId?:string;requestContextHidden?:boolean;requestContext?:{companyId:string;workDate:string;companyName:string;locationName:string;position:string}|null};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
function conversationShape(value:unknown):ConversationInput {
 if(!object(value)||Object.keys(value).some(k=>!['commandId','personId','requestId','channel','outcome','note'].includes(k))||!isUuid(value.commandId)||!isUuid(value.personId)||(value.requestId!==null&&!isUuid(value.requestId))||!Object.hasOwn(conversationChannels,String(value.channel))||!Object.hasOwn(conversationOutcomes,String(value.outcome))||typeof value.note!=='string'||value.note.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.note))throw Error('CONVERSATION_VALIDATION');
 if(value.outcome==='declined'&&value.requestId===null)throw Error('CONVERSATION_REQUEST_REQUIRED');
 return {commandId:value.commandId,personId:value.personId,requestId:value.requestId,channel:value.channel as ConversationInput['channel'],outcome:value.outcome as ConversationInput['outcome'],note:value.note.trim()};
}
export function validateConversation(value:unknown):ConversationInput {
 const input=conversationShape(value);requireOperationalText(input.note);return input;
}
export function parseConversation(value:unknown,scope:TalentScope,personId:string):PersonConversation {
 if(!object(value)||!isUuid(value.id)||value.tenantId!==scope.tenantId||value.personId!==personId||!isUuid(value.actorId)||typeof value.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value.recordedAt)||!Number.isFinite(Date.parse(value.recordedAt)))throw Error('CONVERSATION_RESPONSE');
 if(value.sourcePersonId!==undefined&&!isUuid(value.sourcePersonId))throw Error('CONVERSATION_RESPONSE');
 if(value.requestContextHidden!==undefined&&typeof value.requestContextHidden!=='boolean')throw Error('CONVERSATION_RESPONSE');
 if(value.requestContextHidden===true&&(value.requestId===null||value.requestContext!=null))throw Error('CONVERSATION_RESPONSE');
 let requestContext:PersonConversation['requestContext'];
 if(value.requestContext!==undefined&&value.requestContext!==null){const c=value.requestContext;if(!object(c)||!isUuid(c.companyId)||typeof c.workDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(c.workDate)||!['companyName','locationName','position'].every(k=>typeof c[k]==='string'&&c[k].length>0)||!isUuid(value.requestId))throw Error('CONVERSATION_RESPONSE');requestContext=c as NonNullable<PersonConversation['requestContext']>;}
 const input=conversationShape(Object.fromEntries(['commandId','personId','requestId','channel','outcome','note'].map(k=>[k,value[k]])));
 return {...input,...(value.requestContextHidden!==undefined?{requestContextHidden:value.requestContextHidden as boolean}:{}),...(requestContext?{requestContext}:{}),...(value.sourcePersonId!==undefined?{sourcePersonId:value.sourcePersonId as string}:{}),id:value.id,tenantId:scope.tenantId,actorId:value.actorId,recordedAt:value.recordedAt};
}

export function parseConversationList(value:unknown,scope:TalentScope,personId:string):PersonConversation[]{
 if(!Array.isArray(value)||value.length>21)throw Error('CONVERSATION_RESPONSE');
 const seen=new Set<string>();
 return value.map(item=>{const row=parseConversation(item,scope,personId);if(seen.has(row.id))throw Error('CONVERSATION_RESPONSE');seen.add(row.id);return row;});
}
