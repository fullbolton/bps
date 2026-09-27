import {isUuid} from '@/lib/operations/pilot-validation';
import {parsePerson,validatePersonInput,type Person,type PersonInput,type TalentScope,type Contact} from '@/lib/talent/people';
import {contactKey} from '@/lib/talent/import-contacts';
export const mergeScalarFields=['name','city','district','gender','birthDate'] as const;
export type MergeScalarField=typeof mergeScalarFields[number];
export type MergeSide={person:Person;counts:{conversations:number;attachments:number;pendingAttachments:number;availability:number;assignments:number}};
export type MergeReview={actorId:string;tenantId:string;left:MergeSide;right:MergeSide;restriction:'none'|'two_workers';requiredPrimaryId:string|null;observedAt:string;reviewToken:string};
export type MergeChoices={primaryId:string;fields:Record<MergeScalarField,'left'|'right'>};
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const invalid=():never=>{throw Error('TALENT_MERGE_RESPONSE');};
export function mergePair(left:unknown,right:unknown){if(!isUuid(left)||!isUuid(right)||left===right)throw Error('TALENT_VALIDATION');return {left,right};}
export function parseMergeReview(x:unknown,scope:TalentScope,left:string,right:string):MergeReview{
 mergePair(left,right);
 if(!obj(x)||x.actorId!==scope.actorId||x.tenantId!==scope.tenantId||typeof x.reviewToken!=='string'||!/^[a-f0-9]{32}$/.test(x.reviewToken)||typeof x.observedAt!=='string'||!Number.isFinite(Date.parse(x.observedAt)))return invalid();
 const side=(value:unknown,id:string):MergeSide=>{
  if(!obj(value)||!obj(value.counts))return invalid();
  const person=parsePerson(value.person,scope.tenantId);if(person.id!==id)return invalid();
  // A comparison must not substitute an omitted field for an explicitly unknown value.
  if(person.gender===undefined||person.birthDate===undefined)return invalid();
  const counts={} as MergeSide['counts'];
  for(const k of ['conversations','attachments','pendingAttachments','availability','assignments'] as const){const n=value.counts[k];if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)return invalid();counts[k]=n;}
  if(person.workerId===null&&counts.assignments!==0)return invalid();
  return {person,counts};
 };
 const a=side(x.left,left),b=side(x.right,right);
 const restriction=a.person.workerId&&b.person.workerId?'two_workers':'none';
 const required=a.person.workerId&&!b.person.workerId?left:b.person.workerId&&!a.person.workerId?right:null;
 if(x.restriction!==restriction||x.requiredPrimaryId!==required)return invalid();
 return {actorId:scope.actorId,tenantId:scope.tenantId,left:a,right:b,restriction,requiredPrimaryId:required,observedAt:x.observedAt,reviewToken:x.reviewToken};
}
/** A local proposal only. It is not an authorization, command or merge receipt. */
export function planMergeFields(review:MergeReview,choices:MergeChoices):PersonInput{
 if(review.restriction!=='none')throw Error('TALENT_MERGE_TWO_WORKERS');
 if(!choices||![review.left.person.id,review.right.person.id].includes(choices.primaryId)||(review.requiredPrimaryId&&choices.primaryId!==review.requiredPrimaryId))throw Error('TALENT_MERGE_PRIMARY');
 const a=review.left.person,b=review.right.person;
 if(!choices.fields||Object.keys(choices.fields).length!==mergeScalarFields.length||mergeScalarFields.some(k=>!['left','right'].includes(choices.fields[k])))throw Error('TALENT_MERGE_SELECTION');
 const primary=choices.primaryId===a.id?a:b,other=primary===a?b:a;
 const contacts:Contact[]=[];const seen=new Set<string>();
 for(const c of [...primary.contacts,...other.contacts]){const key=contactKey(c);if(!seen.has(key)){seen.add(key);contacts.push(c);}}
 const union=(x:string[],y:string[])=>[...new Set([...x,...y])];
 const input={...Object.fromEntries(mergeScalarFields.map(k=>[k,(choices.fields[k]==='left'?a:b)[k]])),contacts,skills:union(a.skills,b.skills),regions:union(a.regions,b.regions),workTypes:union(a.workTypes,b.workTypes)};
 // No truncation: exceeding the existing limits requires a deliberate later edit.
 return validatePersonInput(input);
}

export type MergeCommand={commandId:string;leftId:string;rightId:string;primaryId:string;reviewToken:string;fields:MergeChoices['fields'];confirmSamePerson:true;keepPrimaryAvailability:true};
export type MergeReceipt={actorId:string;tenantId:string;commandId:string;primaryId:string;sourceId:string;revision:number;mergedAt:string};
export function validateMergeCommand(x:unknown):MergeCommand{
 if(!obj(x)||!isUuid(x.commandId)||!isUuid(x.primaryId)||typeof x.reviewToken!=='string'||!/^[a-f0-9]{32}$/.test(x.reviewToken)||!obj(x.fields)||Object.keys(x.fields).length!==5||x.confirmSamePerson!==true||x.keepPrimaryAvailability!==true)throw Error('TALENT_VALIDATION');
 const pair=mergePair(x.leftId,x.rightId);
 if(![pair.left,pair.right].includes(x.primaryId)||mergeScalarFields.some(k=>!['left','right'].some(side=>(x.fields as Record<string,unknown>)[k]===side)))throw Error('TALENT_VALIDATION');
 return {commandId:x.commandId,leftId:pair.left,rightId:pair.right,primaryId:x.primaryId,reviewToken:x.reviewToken,fields:x.fields as MergeChoices['fields'],confirmSamePerson:true,keepPrimaryAvailability:true};
}
export function parseMergeReceipt(x:unknown,scope:TalentScope,command:MergeCommand):MergeReceipt{
 if(!obj(x)||x.actorId!==scope.actorId||x.tenantId!==scope.tenantId||x.commandId!==command.commandId||x.primaryId!==command.primaryId||x.sourceId!==(command.primaryId===command.leftId?command.rightId:command.leftId)||!Number.isSafeInteger(x.revision)||Number(x.revision)<1||Number(x.revision)>2147483647||typeof x.mergedAt!=='string'||!Number.isFinite(Date.parse(x.mergedAt)))return invalid();
 return x as MergeReceipt;
}
export function parseMergeResolution(x:unknown,scope:TalentScope,command:MergeCommand):{status:'confirmed';receipt:MergeReceipt}|{status:'closed';commandId:string}{
 if(obj(x)&&x.status==='confirmed')return {status:'confirmed',receipt:parseMergeReceipt(x.receipt,scope,command)};
 if(obj(x)&&x.status==='closed'&&x.commandId===command.commandId)return {status:'closed',commandId:command.commandId};
 return invalid();
}
