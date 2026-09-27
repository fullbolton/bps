import {isUuid} from '@/lib/operations/pilot-validation';
import {conversationChannels} from './conversations';
import type {TalentScope} from './people';
export type ContactSummary={id:string;sourcePersonId:string;recordedAt:string;channel:keyof typeof conversationChannels;outcome:'reached'|'no_answer'|'call_back'};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const timestamp=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
export function validateSummaryIds(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>50||value.some(id=>!isUuid(id))||new Set(value).size!==value.length)throw Error('TALENT_VALIDATION');
 return [...value];
}
/** Missing, malformed or partial summaries must never look like "no conversation". */
export function parseContactSummaries(value:unknown,scope:TalentScope,ids:string[]):Record<string,ContactSummary|null>{
 validateSummaryIds(ids);
 if(!object(value)||value.actorId!==scope.actorId||value.tenantId!==scope.tenantId||!timestamp(value.generatedAt)||!Array.isArray(value.rows)||value.rows.length!==ids.length)throw Error('CONTACT_SUMMARY_RESPONSE');
 const expected=new Set(ids),result:Record<string,ContactSummary|null>={};
 for(const row of value.rows){
  if(!object(row)||typeof row.personId!=='string'||!expected.delete(row.personId))throw Error('CONTACT_SUMMARY_RESPONSE');
  const last=row.last;
  if(last===null){result[row.personId]=null;continue;}
  if(!object(last)||!isUuid(last.id)||!isUuid(last.sourcePersonId)||!timestamp(last.recordedAt)||typeof last.channel!=='string'||!Object.hasOwn(conversationChannels,last.channel)||!['reached','no_answer','call_back'].includes(String(last.outcome)))throw Error('CONTACT_SUMMARY_RESPONSE');
  result[row.personId]={id:last.id,sourcePersonId:last.sourcePersonId,recordedAt:last.recordedAt,channel:last.channel as ContactSummary['channel'],outcome:last.outcome as ContactSummary['outcome']};
 }
 if(expected.size)throw Error('CONTACT_SUMMARY_RESPONSE');
 return result;
}
