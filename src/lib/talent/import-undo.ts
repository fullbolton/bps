import {checkTalentScope,emptyPerson,validatePersonInput,type TalentScope} from './people';
import {isUuid} from '@/lib/operations/pilot-validation';
export const importChangeLabels={name:'Ad soyad',city:'İkamet ili',district:'İkamet ilçesi',contacts:'İletişim bilgileri',skills:'Meslekler',regions:'Çalışma bölgeleri'} as const;
export type ChangeField=keyof typeof importChangeLabels;
export type ImportChange={field:ChangeField;before:unknown;after:unknown};
export type ImportChangeReview=TalentScope&{batchId:string;number:number;personId:string|null;state:'ready'|'changed'|'undone'|'legacy'|'not_updated';changes:ImportChange[];undoneAt:string|null};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function importChangeTarget(batchId:unknown,number:unknown){if(!isUuid(batchId)||typeof number!=='number'||!Number.isInteger(number)||number<1||number>50001)throw Error('TALENT_IMPORT_VALIDATION');return {batchId,number};}
export function parseImportChangeReview(value:unknown,scope:TalentScope,batchId:string,number:number):ImportChangeReview{
 const s=checkTalentScope(scope),target=importChangeTarget(batchId,number),bad=():never=>{throw Error('TALENT_IMPORT_RESPONSE');};
 if(!object(value)||value.actorId!==s.actorId||value.tenantId!==s.tenantId||value.batchId!==target.batchId||value.number!==target.number||!['ready','changed','undone','legacy','not_updated'].includes(String(value.state))||!(value.personId===null||isUuid(value.personId))||!Array.isArray(value.changes)||value.changes.length>6)return bad();
 if(value.state==='undone'?typeof value.undoneAt!=='string'||!Number.isFinite(Date.parse(value.undoneAt)):value.undoneAt!==null)return bad();
 const fields=new Set<string>();const changes=value.changes.map(c=>{
  if(!object(c)||typeof c.field!=='string'||!Object.hasOwn(importChangeLabels,c.field)||fields.has(c.field))return bad();fields.add(c.field);
  for(const side of ['before','after'])try{validatePersonInput({...emptyPerson,name:'Kontrol',[c.field]:c[side]});}catch{return bad();}
  if(JSON.stringify(c.before)===JSON.stringify(c.after))return bad();
  return {field:c.field as ChangeField,before:c.before,after:c.after};
 });
 if(['ready','changed','undone'].includes(String(value.state))&&(!value.personId||!changes.length))return bad();
 if(['legacy','not_updated'].includes(String(value.state))&&changes.length)return bad();
 return {...s,...target,personId:value.personId as string|null,state:value.state as ImportChangeReview['state'],changes,undoneAt:value.undoneAt as string|null};
}
export function formatImportChange(value:unknown):string{
 if(value===null)return 'Boş';
 if(typeof value==='string')return value;
 if(Array.isArray(value))return value.map(v=>typeof v==='string'?v:object(v)&&typeof v.value==='string'?v.value:'').join(' · ')||'Boş';
 throw Error('TALENT_IMPORT_RESPONSE');
}
