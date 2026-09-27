import {importContacts} from './import-contacts';
import {checkTalentScope,type TalentScope} from './people';
import {isUuid} from '@/lib/operations/pilot-validation';
import {parseCompareSnapshot,differences,type SourcePerson,type ComparedRow,type CompareSnapshot,type ComparePerson} from './import-compare';
export type MatchQuery={number:number;name:string;phone:string;email:string;personId?:string};
export type MatchPage={generatedAt:string;rows:ComparedRow[]};
export type MatchDataset={snapshot:CompareSnapshot;compared:ComparedRow[]};
const bad=():never=>{throw Error('TALENT_MATCH_RESPONSE');};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateMatchQueries(value:unknown):MatchQuery[]{
 if(!Array.isArray(value)||value.length<1||value.length>100)return bad();
 const numbers=new Set<number>();
 return value.map(q=>{
  if(!object(q)||Object.keys(q).some(k=>!['number','name','phone','email','personId'].includes(k))||!Number.isInteger(q.number)||Number(q.number)<1||Number(q.number)>50001||numbers.has(Number(q.number)))return bad();
  for(const [key,max]of [['name',160],['phone',320],['email',2560]]as const)if(typeof q[key]!=='string'||q[key].length>max||/[\u0000-\u001f\u007f]/.test(q[key]))return bad();
  if(!(q.name as string).trim()||('personId'in q&&!isUuid(q.personId)))return bad();
  importContacts({phone:q.phone as string,email:q.email as string});
  numbers.add(Number(q.number));return {number:Number(q.number),name:q.name as string,phone:q.phone as string,email:q.email as string,...('personId'in q?{personId:q.personId as string}:{})};
 });
}
export function matchQueries(rows:SourcePerson[],scope:TalentScope):MatchQuery[]{
 checkTalentScope(scope);
 return rows.filter(r=>!r.issues.length&&(!r.tenantId||r.tenantId===scope.tenantId)).map(r=>({number:r.number,name:r.name,phone:r.phone,email:r.email,...(r.personId?{personId:r.personId}:{})}));
}
export function parseMatchPage(input:unknown,scope:TalentScope,source:SourcePerson[],queries:MatchQuery[]):MatchPage{
 const expected=validateMatchQueries(queries),s=checkTalentScope(scope),byNumber=new Map(source.map(r=>[r.number,r]));
 if(!object(input)||input.actorId!==s.actorId||input.tenantId!==s.tenantId||typeof input.generatedAt!=='string'||!Number.isFinite(Date.parse(input.generatedAt))||!Array.isArray(input.rows)||input.rows.length!==expected.length)return bad();
 const rows=input.rows.map((v,i):ComparedRow=>{
  if(!object(v)||v.number!==expected[i].number||!Array.isArray(v.candidates)||v.candidates.length>20||typeof v.more!=='boolean'||(v.more&&v.candidates.length!==20))return bad();
  const row=byNumber.get(expected[i].number);if(!row)return bad();
  const people=parseCompareSnapshot({...s,generatedAt:input.generatedAt,total:v.candidates.length,rows:v.candidates.map(c=>object(c)?c.person:null)},s).rows;
  const candidates=v.candidates.map((c,j)=>{
   if(!object(c)||!Array.isArray(c.reasons)||!c.reasons.length||new Set(c.reasons).size!==c.reasons.length||c.reasons.some(r=>!['BPS kişi kimliği','İsim benzerliği','Telefon eşleşmesi','E-posta eşleşmesi'].includes(String(r))))return bad();
   if(row.personId&&(people[j].id!==row.personId||c.reasons.length!==1||c.reasons[0]!=='BPS kişi kimliği'))return bad();
   if(!row.personId&&c.reasons.includes('BPS kişi kimliği'))return bad();
   return {person:people[j],reasons:c.reasons as string[],differences:differences(row,people[j])};
  });
  const issues=[...row.issues];if(row.personId&&!candidates.length)issues.push('BPS kişi kimliği bu şirketin güncel havuzunda bulunamadı. Satırı bekletin.');
  return {number:row.number,status:issues.length||v.more||candidates.length>1?'review':candidates.length?'match':'new',candidates,moreCandidates:v.more,issues,warnings:row.warnings};
 });return {generatedAt:input.generatedAt,rows};
}
/** Pages are not a single DB snapshot. Revisions fence writes; changing repeated people invalidates the whole review. */
export async function loadTargetedComparison(rows:SourcePerson[],scope:TalentScope,fetchPage:(queries:MatchQuery[])=>Promise<unknown>,progress:(done:number,total:number)=>void,active:()=>boolean):Promise<MatchDataset>{
 if(!rows.length||rows.length>50000||new Set(rows.map(r=>r.number)).size!==rows.length)throw Error('TALENT_MATCH_RESPONSE');
 const queries=matchQueries(rows,scope),matches=new Map<number,ComparedRow>(),people=new Map<string,ComparePerson>();let bytes=0,generatedAt=new Date().toISOString();
 const sourceByNumber=new Map(rows.map(r=>[r.number,r]));
 for(let offset=0;offset<queries.length;){
  if(!active())throw Error('TALENT_MATCH_CANCELLED');
  // Long multi-contact cells must also fit the server's 256 KiB request limit.
  const pageQueries:MatchQuery[]=[];let pageBytes=2;
  while(offset+pageQueries.length<queries.length&&pageQueries.length<100){
   const q=queries[offset+pageQueries.length],bytes=new TextEncoder().encode(JSON.stringify(q)).length+1;
   if(pageQueries.length&&pageBytes+bytes>240000)break;
   pageQueries.push(q);pageBytes+=bytes;
  }
  const batch=validateMatchQueries(pageQueries);
  const raw=await fetchPage(batch);if(!active())throw Error('TALENT_MATCH_CANCELLED');
  const page=parseMatchPage(raw,scope,batch.map(q=>sourceByNumber.get(q.number)!),batch);generatedAt=page.generatedAt;
  for(const row of page.rows){
   for(const c of row.candidates){const old=people.get(c.person.id);if(old&&JSON.stringify(old)!==JSON.stringify(c.person))throw Error('TALENT_MATCH_CHANGED');if(!old){people.set(c.person.id,c.person);bytes+=new TextEncoder().encode(JSON.stringify(c.person)).length;}else c.person=old;}
   bytes+=new TextEncoder().encode(JSON.stringify({...row,candidates:row.candidates.map(c=>({id:c.person.id,reasons:c.reasons,differences:c.differences}))})).length;
   if(people.size>25000||bytes>32*1024*1024)throw Error('TALENT_MATCH_REVIEW_LIMIT');
   matches.set(row.number,row);
  }
  offset+=batch.length;progress(offset,queries.length);
 }
 const compared=rows.map(r=>matches.get(r.number)??{number:r.number,status:'review' as const,candidates:[],moreCandidates:false,issues:[...r.issues,...(r.tenantId&&r.tenantId!==scope.tenantId?['Bu satır başka bir BPS şirketine ait. Doğru çalışma alanını seçin.']:[])],warnings:r.warnings});
 return {snapshot:{...scope,total:people.size,generatedAt,rows:[...people.values()]},compared};
}
