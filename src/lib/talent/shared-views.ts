import {isUuid} from '@/lib/operations/pilot-validation';
import {checkTalentScope,validatePeopleQuery,type TalentScope,type PeopleQuery} from './people';
export type SharedView={id:string;name:string;query:PeopleQuery;canRemove:boolean};
export function sharedViewInput(id:unknown,name:unknown,query:unknown){
 if(!isUuid(id)||typeof name!=='string'||!name.trim()||name.length>60||/[\u0000-\u001f\u007f]/.test(name))throw Error('TALENT_VALIDATION');
 return {id,name:name.trim(),query:{...validatePeopleQuery(query),offset:0}};
}
export function parseSharedViews(value:unknown,scope:TalentScope):SharedView[]{
 checkTalentScope(scope);
 if(!value||typeof value!=='object'||!('actorId' in value)||value.actorId!==scope.actorId||!('tenantId' in value)||value.tenantId!==scope.tenantId||!('rows' in value)||!Array.isArray(value.rows)||value.rows.length>100)throw Error('TALENT_RESPONSE');
 const seen=new Set<string>();
 return value.rows.map(row=>{
  if(!row||typeof row!=='object'||typeof row.canRemove!=='boolean'||seen.has(row.id)||row.query?.offset!==0)throw Error('TALENT_RESPONSE');
  const parsed=sharedViewInput(row.id,row.name,row.query);seen.add(parsed.id);
  return {...parsed,canRemove:row.canRemove};
 });
}
