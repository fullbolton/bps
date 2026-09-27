import {isUuid} from '@/lib/operations/pilot-validation';
import {parseAvailability,type AvailabilityRow} from './availability';
import type {TalentScope} from './people';

export type MergedAvailabilityRow=AvailabilityRow&{source_name:string};
export function checkMergedAvailabilityQuery(personId:unknown,offset:unknown){
 if(!isUuid(personId)||typeof offset!=='number'||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%20!==0)throw Error('AVAILABILITY_VALIDATION');
 return {personId,offset};
}
/** Archived confirmations never participate in the main card's current availability. */
export function parseMergedAvailability(value:unknown,scope:TalentScope,personId:string,offset:number):MergedAvailabilityRow[]{
 checkMergedAvailabilityQuery(personId,offset);
 const bad=():never=>{throw Error('AVAILABILITY_RESPONSE');};
 if(!value||typeof value!=='object'||Array.isArray(value))return bad();
 const x=value as Record<string,unknown>;
 if(x.actorId!==scope.actorId||x.tenantId!==scope.tenantId||x.personId!==personId||x.offset!==offset||!Array.isArray(x.rows)||x.rows.length>21)return bad();
 const seen=new Set<string>();
 return x.rows.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))return bad();
  const row=item as Record<string,unknown>;
  if(!isUuid(row.person_id)||row.person_id===personId||typeof row.source_name!=='string'||!row.source_name.trim()||row.source_name.length>160||/[\u0000-\u001f\u007f]/.test(row.source_name))return bad();
  const parsed=parseAvailability([row],scope,row.person_id)[0];
  if(seen.has(parsed.id))return bad();
  seen.add(parsed.id);
  return {...parsed,source_name:row.source_name};
 });
}
