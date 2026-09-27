import {isUuid} from '@/lib/operations/pilot-validation';
import type {TalentScope} from './people';
export const availabilityLabels={available:'Müsait olduğunu teyit etti',unavailable:'Müsait değil',unknown:'Yeniden teyit gerekli'} as const;
export type AvailabilityInput={commandId:string;expectedRevision:number;state:keyof typeof availabilityLabels;startsOn:string;endsOn:string};
export type AvailabilityRow={id:string;tenant_id:string;person_id:string;actor_id:string;command_id:string;revision:number;expected_revision:number;state:AvailabilityInput['state'];starts_on:string;ends_on:string;recorded_at:string};
const date=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='2000-01-01'&&s<='2100-12-31'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
export function validateAvailability(input:unknown):AvailabilityInput{
 if(!input||typeof input!=='object')throw Error('AVAILABILITY_VALIDATION');
 const v=input as AvailabilityInput;
 if(!isUuid(v.commandId)||!Number.isSafeInteger(v.expectedRevision)||v.expectedRevision<0||v.expectedRevision>=2147483647||!Object.hasOwn(availabilityLabels,v.state)||!date(v.startsOn)||!date(v.endsOn)||v.endsOn<v.startsOn||(Date.parse(v.endsOn)-Date.parse(v.startsOn))/86400000>366)throw Error('AVAILABILITY_VALIDATION');
 return {commandId:v.commandId,expectedRevision:v.expectedRevision,state:v.state,startsOn:v.startsOn,endsOn:v.endsOn};
}
export function parseAvailability(value:unknown,scope:TalentScope,personId:string):AvailabilityRow[]{
 if(!Array.isArray(value)||value.length>10)throw Error('AVAILABILITY_RESPONSE');
 let previous=Infinity;
 return value.map(r=>{
  if(!r||r.tenant_id!==scope.tenantId||r.person_id!==personId||!isUuid(r.id)||!isUuid(r.actor_id)||!Number.isSafeInteger(r.revision)||r.revision!==r.expected_revision+1||r.revision>=previous||typeof r.recorded_at!=='string'||!Number.isFinite(Date.parse(r.recorded_at)))throw Error('AVAILABILITY_RESPONSE');
  validateAvailability({commandId:r.command_id,expectedRevision:r.expected_revision,state:r.state,startsOn:r.starts_on,endsOn:r.ends_on});previous=r.revision;
  return {id:r.id,tenant_id:r.tenant_id,person_id:r.person_id,actor_id:r.actor_id,command_id:r.command_id,revision:r.revision,expected_revision:r.expected_revision,state:r.state,starts_on:r.starts_on,ends_on:r.ends_on,recorded_at:r.recorded_at};
 });
}
/** Only latest confirmation applies; older periods are history, never fallback facts. */
export function availabilityOn(rows:AvailabilityRow[],day:string):AvailabilityInput['state']{
 const latest=rows[0];return latest&&day>=latest.starts_on&&day<=latest.ends_on?latest.state:'unknown';
}
