import {isUuid} from '@/lib/operations/pilot-validation';
import {parsePerson,type TalentScope,type Person} from './people';
export type CallList={id:string;name:string;selectedCount:number;canRemove:boolean};
export type CallListPeople={id:string;name:string;selectedCount:number;revision:number;canEdit:boolean;people:Person[]};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const nameValid=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=60&&!/[\u0000-\u001f\u007f]/.test(x);
export function validateCallList(id:unknown,name:unknown,ids:unknown){
 if(!isUuid(id)||!nameValid(name)||!Array.isArray(ids)||ids.length<1||ids.length>50||ids.some(x=>!isUuid(x))||new Set(ids).size!==ids.length)throw Error('TALENT_VALIDATION');
 return {id,name:name.trim(),ids:ids as string[]};
}
function scoped(x:unknown,s:TalentScope):asserts x is Record<string,unknown>{if(!object(x)||x.actorId!==s.actorId||x.tenantId!==s.tenantId)throw Error('CALL_LIST_RESPONSE');}
function metadata(x:unknown):asserts x is Record<string,unknown>&{id:string;name:string;selectedCount:number}{if(!object(x)||!isUuid(x.id)||!nameValid(x.name)||!Number.isInteger(x.selectedCount)||Number(x.selectedCount)<1||Number(x.selectedCount)>50)throw Error('CALL_LIST_RESPONSE');}
export function parseCallLists(x:unknown,s:TalentScope):CallList[]{
 scoped(x,s);if(!Array.isArray(x.rows)||x.rows.length>100)throw Error('CALL_LIST_RESPONSE');const seen=new Set<string>();
 return x.rows.map(r=>{metadata(r);if(seen.has(r.id)||typeof r.canRemove!=='boolean')throw Error('CALL_LIST_RESPONSE');seen.add(r.id);return {id:r.id,name:r.name,selectedCount:r.selectedCount,canRemove:r.canRemove};});
}
export function parseCallListPeople(x:unknown,s:TalentScope,id:string):CallListPeople{
 scoped(x,s);metadata(x);if(!Number.isSafeInteger(x.revision)||Number(x.revision)<1||typeof x.canEdit!=='boolean'||x.id!==id||!Array.isArray(x.people)||!x.people.length||x.people.length>x.selectedCount)throw Error('CALL_LIST_RESPONSE');
 const people=x.people.map(p=>parsePerson(p,s.tenantId));if(new Set(people.map(p=>p.id)).size!==people.length)throw Error('CALL_LIST_RESPONSE');
 return {id:x.id,name:x.name,selectedCount:x.selectedCount,revision:x.revision as number,canEdit:x.canEdit as boolean,people};
}

export type CallListEdit={commandId:string;id:string;revision:number;operation:'rename'|'add'|'remove';name:string|null;ids:string[]};
export function validateCallListEdit(x:CallListEdit):CallListEdit{
 if(!x||!isUuid(x.commandId)||!isUuid(x.id)||!Number.isSafeInteger(x.revision)||x.revision<1||!['rename','add','remove'].includes(x.operation)||!Array.isArray(x.ids)||x.ids.length>50||x.ids.some(id=>!isUuid(id))||new Set(x.ids).size!==x.ids.length)throw Error('TALENT_VALIDATION');
 if(x.operation==='rename'?!nameValid(x.name)||x.ids.length!==0:x.name!==null||x.ids.length===0)throw Error('TALENT_VALIDATION');
 return {...x,name:x.name?.trim()??null};
}
