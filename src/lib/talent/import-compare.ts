import {contactKey,importContacts} from './import-contacts';
export {contactKey} from './import-contacts';
import {checkTalentScope,validatePersonInput,emptyPerson,type TalentScope,type Contact} from './people';
import {normal,previewSource} from './import-preview';
import {importList} from './import-fields';
import {isUuid} from '@/lib/operations/pilot-validation';
export type ComparePerson={id:string;revision:number;name:string;city:string|null;district?:string|null;skills?:string[];regions?:string[];contacts:Contact[]};
export type CompareSnapshot=TalentScope&{total:number;generatedAt:string;rows:ComparePerson[]};
export type SourcePerson=ReturnType<typeof previewSource>['rows'][number];
export type Difference={field:'name'|'city'|'district'|'skills'|'regions'|'contacts';before:string;after:string;kind:'add'|'replace';contactKind?:Contact['kind']};
export type MatchCandidate={person:ComparePerson;reasons:string[];differences:Difference[]};
export type ComparedRow={number:number;status:'new'|'match'|'review';candidates:MatchCandidate[];moreCandidates:boolean;issues:string[];warnings?:string[]};
export const compareLabels={new:'Yeni kayıt adayı',match:'Olası eşleşme',review:'İnceleme gerekiyor'};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function parseCompareSnapshot(input:unknown,expected:TalentScope):CompareSnapshot{
 const scope=checkTalentScope(expected),bad=():never=>{throw Error('TALENT_COMPARE_RESPONSE');};
 if(!object(input)||input.actorId!==scope.actorId||input.tenantId!==scope.tenantId||!Number.isInteger(input.total)||Number(input.total)<0||Number(input.total)>10000||!Array.isArray(input.rows)||input.rows.length!==input.total||typeof input.generatedAt!=='string'||!Number.isFinite(Date.parse(input.generatedAt)))return bad();
 const ids=new Set<string>();const rows=input.rows.map(v=>{
  if(!object(v)||!isUuid(v.id)||ids.has(v.id)||!Number.isInteger(v.revision)||Number(v.revision)<0||Number(v.revision)>2147483647)return bad();
  ids.add(v.id);const p=validatePersonInput({...emptyPerson,name:v.name,city:v.city,contacts:v.contacts,district:v.district,skills:v.skills,regions:v.regions});
  return {id:v.id,revision:Number(v.revision),name:p.name,city:p.city,contacts:p.contacts,district:p.district,skills:p.skills,regions:p.regions};
 });return {...scope,total:rows.length,generatedAt:input.generatedAt,rows};
}
export function differences(row:SourcePerson,p:ComparePerson):Difference[]{
 if(row.issues.length)return [];
 const result:Difference[]=[];
 // Missing source values never become a deletion proposal.
 if(row.name&&row.name!==p.name)result.push({field:'name',before:p.name,after:row.name,kind:'replace'});
 if(row.city&&row.city!==p.city)result.push({field:'city',before:p.city??'Boş',after:row.city,kind:p.city?'replace':'add'});
 if(row.district&&row.district!==p.district)result.push({field:'district',before:p.district??'Boş',after:row.district,kind:p.district?'replace':'add'});
 for(const field of ['skills','regions'] as const){let values:string[];try{values=importList(row[field]??'');}catch{continue;}const added=values.filter(v=>!(p[field]??[]).includes(v));if(added.length)result.push({field,before:(p[field]??[]).join('; ')||'Boş',after:added.join('; '),kind:'add'});}
 const oldKeys=new Set(p.contacts.map(contactKey));
 for(const kind of ['phone','email'] as const){
  const added=importContacts(row).filter(c=>c.kind===kind&&!oldKeys.has(contactKey(c)));
  if(added.length)result.push({field:'contacts',contactKind:kind,before:p.contacts.filter(c=>c.kind===kind).map(v=>v.value).join(' · ')||'Boş',after:added.map(c=>c.value).join('; '),kind:'add'});
 }
 return result;
}
export function compareSourcePeople(rows:SourcePerson[],pool:CompareSnapshot):ComparedRow[]{
 if(rows.length>50000)throw Error('TALENT_COMPARE_SOURCE_LIMIT');
 const byId=new Map(pool.rows.map(p=>[p.id,p]));
 const byName=new Map<string,ComparePerson[]>(),byContact=new Map<string,ComparePerson[]>();
 const add=(map:Map<string,ComparePerson[]>,key:string,p:ComparePerson)=>{if(!key)return;const list=map.get(key);if(list)list.push(p);else map.set(key,[p]);};
 for(const p of pool.rows){add(byName,normal(p.name),p);for(const c of p.contacts)add(byContact,contactKey(c),p);}
 return rows.map(r=>{
  if(r.personId||r.tenantId){
   const person=r.personId?byId.get(r.personId):undefined;
   const problems=[...r.issues];
   if(!isUuid(r.personId)||!isUuid(r.tenantId))problems.push('BPS kişi ve şirket kimliklerini birlikte kontrol edin.');
   else if(r.tenantId!==pool.tenantId)problems.push('Bu satır başka bir BPS şirketine ait. Doğru çalışma alanını seçin; kimlikleri silerek aktarmayın.');
   else if(!person)problems.push('BPS kişi kimliği bu şirketin güncel havuzunda bulunamadı. Satırı bekletin.');
   return {number:r.number,status:problems.length?'review' as const:'match' as const,candidates:problems.length||!person?[]:[{person,reasons:['BPS kişi kimliği'],differences:differences(r,person)}],moreCandidates:false,issues:problems,warnings:r.warnings};
  }
  const found=new Map<string,{person:ComparePerson;reasons:Set<string>}>();let moreCandidates=false;
  const gather=(people:ComparePerson[]|undefined,reason:string)=>{for(const p of people??[]){if(!found.has(p.id)&&found.size>=20){moreCandidates=true;break;}const candidate=found.get(p.id)??{person:p,reasons:new Set<string>()};candidate.reasons.add(reason);found.set(p.id,candidate);}};
  gather(byName.get(normal(r.name)),'İsim benzerliği');
  if(!r.issues.length)for(const c of importContacts(r))gather(byContact.get(contactKey(c)),c.kind==='phone'?'Telefon eşleşmesi':'E-posta eşleşmesi');
  const candidates=[...found.values()].map(c=>({person:c.person,reasons:[...c.reasons],differences:differences(r,c.person)}));
  return {number:r.number,status:r.issues.length||moreCandidates||candidates.length>1?'review':candidates.length?'match':'new',candidates,moreCandidates,issues:r.issues,warnings:r.warnings};
 });
}
