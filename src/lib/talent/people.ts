import {isUuid} from '@/lib/operations/pilot-validation';

export type TalentScope={actorId:string;tenantId:string};
export type Contact={kind:'phone'|'email';value:string};
export type WorkType='idp'|'sabit'|'donemsel';
export type Gender='female'|'male'|'other';
export type PersonInput={gender?:Gender|null;birthDate?:string|null;name:string;city:string|null;district:string|null;contacts:Contact[];skills:string[];regions:string[];workTypes:WorkType[]};
export type Person=PersonInput&{id:string;tenantId:string;revision:number;workerId:string|null;workerCode:string|null;workerActive:boolean|null;source:'manual'|'operations'|'import';createdAt:string;updatedAt:string};
export type PeopleQuery={search:string;city:string;skill:string;district?:string;gender?:string;ageMin?:string;ageMax?:string;workType?:string;availabilityDay?:string;availabilityState?:string;view:'all'|'contact_missing'|'linked'|'call_back';offset:number};
export type PeoplePage={tenantId:string;query:PeopleQuery;total:number;rows:Person[];generatedAt:string};
export type PersonEvent={id:string;kind:'created'|'updated'|'worker_synced';revision:number;changedFields:string[];occurredAt:string;actorName:string|null};
export type PersonAssignment={id:string;workDate:string;companyName:string;locationName:string;position:string;removed:boolean};
export type PersonDetail={staffingAvailable:boolean|null;person:Person;events:PersonEvent[];assignments:PersonAssignment[];redirectedFromId:string|null;mergedSourceCount:number};
export type SavePerson={commandId:string;personId:string|null;expectedRevision:number|null;input:PersonInput};
export type SaveReceipt={id:string;commandId:string;revision:number};
export type PendingPerson=Omit<SavePerson,'input'>;
export type PersonResolution={status:'confirmed';receipt:SaveReceipt}|{status:'closed';commandId:string};
export const emptyPerson:PersonInput={name:'',city:null,district:null,contacts:[],skills:[],regions:[],workTypes:[]};
export const initialQuery:PeopleQuery={search:'',city:'',skill:'',district:'',gender:'',ageMin:'',ageMax:'',workType:'',availabilityDay:'',availabilityState:'',view:'all',offset:0};
export const workTypeLabels:Record<WorkType,string>={idp:'İDP',sabit:'Sabit',donemsel:'Dönemsel'};
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const clean=(x:unknown,max:number):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=max&&!/[\u0000-\u001f\u007f]/.test(x);
const revision=(x:unknown):x is number=>typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<=2147483647;
const date=(x:unknown):x is string=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const invalid=():never=>{throw Error('TALENT_VALIDATION');};
const bad=():never=>{throw Error('TALENT_RESPONSE');};
export function checkTalentScope(x:unknown):TalentScope{
 if(!record(x)||!isUuid(x.actorId)||!isUuid(x.tenantId))throw Error('TALENT_SCOPE');
 return {actorId:x.actorId,tenantId:x.tenantId};
}
export function validatePersonInput(x:unknown):PersonInput{
 if(!record(x)||Object.keys(x).some(k=>!['name','city','district','contacts','skills','regions','workTypes','gender','birthDate'].includes(k))||!clean(x.name,160))return invalid();
 if((x.city!==null&&!clean(x.city,80))||(x.district!==null&&!clean(x.district,80))||!Array.isArray(x.contacts)||x.contacts.length>10)return invalid();
 if(x.gender!==undefined&&x.gender!==null&&!['female','male','other'].includes(x.gender as string))return invalid();
 if(x.birthDate!==undefined&&x.birthDate!==null){
  if(typeof x.birthDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(x.birthDate))return invalid();
  const parsed=new Date(x.birthDate+'T00:00:00Z');
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==x.birthDate||x.birthDate<'1900-01-01'||x.birthDate>today)return invalid();
 }
 const contacts:Contact[]=x.contacts.map(c=>{
  if(!record(c)||Object.keys(c).some(k=>!['kind','value'].includes(k))||!clean(c.value,254))return invalid();
  const value=c.value.trim();
  if(c.kind==='phone'&&/^\+?[0-9][0-9 ()-]{5,29}$/.test(value))return {kind:'phone',value};
  if(c.kind==='email'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return {kind:'email',value};
  return invalid();
 });
 const list=(value:unknown):string[]=>{
  if(!Array.isArray(value)||value.length>20||value.some(v=>!clean(v,80)))return invalid();
  return [...new Set(value.map(v=>(v as string).trim()))].sort();
 };
 const skills=list(x.skills),regions=list(x.regions),types=list(x.workTypes);
 if(types.some(v=>!['idp','sabit','donemsel'].includes(v)))return invalid();
 return {...(x.gender!==undefined?{gender:x.gender as Gender|null}:{}),...(x.birthDate!==undefined?{birthDate:x.birthDate as string|null}:{}),name:x.name.trim(),city:x.city===null?null:x.city.trim(),district:x.district===null?null:x.district.trim(),contacts,skills,regions,workTypes:types as WorkType[]};
}
export function validatePeopleQuery(x:unknown):PeopleQuery{
 if(!record(x)||typeof x.search!=='string'||typeof x.city!=='string'||typeof x.skill!=='string'||x.search.length>160||x.city.length>80||x.skill.length>80||/[\u0000-\u001f\u007f]/.test(x.search+x.city+x.skill)||!['all','contact_missing','linked','call_back'].includes(x.view as string)||!revision(x.offset)||x.offset>1000000||x.offset%50!==0)return invalid();
 const extra={district:x.district===undefined?'':x.district,gender:x.gender===undefined?'':x.gender,ageMin:x.ageMin===undefined?'':x.ageMin,ageMax:x.ageMax===undefined?'':x.ageMax,workType:x.workType===undefined?'':x.workType,availabilityDay:x.availabilityDay===undefined?'':x.availabilityDay,availabilityState:x.availabilityState===undefined?'':x.availabilityState};
 if(Object.values(extra).some(v=>typeof v!=='string')||typeof extra.district!=='string'||extra.district.length>80||/[\u0000-\u001f\u007f]/.test(extra.district))return invalid();
 if(!['','female','male','other','unknown'].includes(extra.gender as string)||!['','idp','sabit','donemsel'].includes(extra.workType as string))return invalid();
 if(!['','available','unavailable','unknown'].includes(extra.availabilityState as string))return invalid();
 const day=extra.availabilityDay;
 if(typeof day!=='string'||(day!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day<'2000-01-01'||day>'2100-12-31'||!Number.isFinite(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))||Boolean(day)!==Boolean(extra.availabilityState))return invalid();
 for(const age of [extra.ageMin,extra.ageMax])if(age!==''&&(typeof age!=='string'||!/^\d{1,3}$/.test(age)||Number(age)>120))return invalid();
 if(extra.ageMin!==''&&extra.ageMax!==''&&Number(extra.ageMin)>Number(extra.ageMax))return invalid();
 return {...extra as {district:string;gender:string;ageMin:string;ageMax:string;workType:string;availabilityDay:string;availabilityState:string},district:extra.district.trim(),search:x.search.trim(),city:x.city.trim(),skill:x.skill.trim(),view:x.view as PeopleQuery['view'],offset:x.offset};
}
export function validateSavePerson(x:unknown):SavePerson{
 if(!record(x)||!isUuid(x.commandId)||(x.personId!==null&&!isUuid(x.personId))||(x.personId===null?x.expectedRevision!==null:!revision(x.expectedRevision)||x.expectedRevision>2147483646))return invalid();
 return {commandId:x.commandId,personId:x.personId,expectedRevision:x.expectedRevision as number|null,input:validatePersonInput(x.input)};
}
export function parsePerson(x:unknown,tenantId:string):Person{
 if(!record(x)||!isUuid(x.id)||x.tenantId!==tenantId||!revision(x.revision)||!['manual','operations','import'].includes(x.source as string)||!date(x.createdAt)||!date(x.updatedAt))return bad();
 if(x.workerId===null){if(x.workerCode!==null||x.workerActive!==null)return bad();}
 else if(!isUuid(x.workerId)||!clean(x.workerCode,40)||typeof x.workerActive!=='boolean')return bad();
 const input=validatePersonInput(Object.fromEntries(['name','city','district','contacts','skills','regions','workTypes','gender','birthDate'].map(k=>[k,x[k]])));
 return {...input,id:x.id,tenantId,revision:x.revision,workerId:x.workerId as string|null,workerCode:x.workerCode as string|null,workerActive:x.workerActive as boolean|null,source:x.source as Person['source'],createdAt:x.createdAt,updatedAt:x.updatedAt};
}
export function parsePeoplePage(x:unknown,scope:TalentScope,query:PeopleQuery):PeoplePage{
 if(!record(x)||x.tenantId!==scope.tenantId||!record(x.query)||Object.entries(query).some(([k,v])=>(x.query as Record<string,unknown>)[k]!==v)||!revision(x.total)||x.total>1000050||!Array.isArray(x.rows)||x.rows.length!==Math.min(50,Math.max(0,x.total-query.offset))||!date(x.generatedAt))return bad();
 const rows=x.rows.map(r=>parsePerson(r,scope.tenantId));
 if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>query.view==='contact_missing'&&r.contacts.length>0||query.view==='linked'&&r.workerId===null))return bad();
 return {tenantId:scope.tenantId,query,total:x.total,rows,generatedAt:x.generatedAt};
}
export function parsePersonDetail(x:unknown,scope:TalentScope,id:string):PersonDetail{
 if(!record(x)||!Array.isArray(x.events)||x.events.length>20||!Array.isArray(x.assignments)||x.assignments.length>10)return bad();
 // Legacy responses are unknown, never evidence that staffing is enabled.
 const staffingAvailable=x.staffingAvailable===undefined?null:x.staffingAvailable;
 if(staffingAvailable!==null&&typeof staffingAvailable!=='boolean'||x.staffingAvailable===null||staffingAvailable===false&&x.assignments.length>0)return bad();
 const person=parsePerson(x.person,scope.tenantId);
 const redirectedFromId=x.redirectedFromId===undefined?null:x.redirectedFromId;
 const mergedSourceCount=x.mergedSourceCount===undefined?0:x.mergedSourceCount;
 if(!Number.isSafeInteger(mergedSourceCount)||typeof mergedSourceCount!=='number'||mergedSourceCount<0)return bad();
 // Only an explicit server redirect permits a different ID; never accept an unrelated card.
 if(person.id===id?redirectedFromId!==null:redirectedFromId!==id||mergedSourceCount<1)return bad();
 for(const e of x.events){if(!record(e)||typeof e.id!=='string'||!/^\d+$/.test(e.id)||!['created','updated','worker_synced'].includes(e.kind as string)||!revision(e.revision)||!Array.isArray(e.changedFields)||e.changedFields.some(v=>typeof v!=='string')||!date(e.occurredAt)||(e.actorName!==null&&typeof e.actorName!=='string'))return bad();}
 for(const a of x.assignments){if(!record(a)||!isUuid(a.id)||typeof a.workDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.workDate)||!clean(a.companyName,500)||!clean(a.locationName,160)||!clean(a.position,80)||typeof a.removed!=='boolean')return bad();}
 return {staffingAvailable,person,events:x.events as PersonEvent[],assignments:x.assignments as PersonAssignment[],redirectedFromId:redirectedFromId as string|null,mergedSourceCount};
}
export function parseSaveReceipt(x:unknown,command:PendingPerson):SaveReceipt{
 if(!record(x)||x.commandId!==command.commandId||x.id!==(command.personId??command.commandId)||x.revision!==(command.expectedRevision===null?0:command.expectedRevision+1))return bad();
 return x as SaveReceipt;
}
export function parsePendingPerson(x:unknown):PendingPerson{
 if(!record(x)||!isUuid(x.commandId)||(x.personId!==null&&!isUuid(x.personId))||(x.personId===null?x.expectedRevision!==null:!revision(x.expectedRevision)||x.expectedRevision>2147483646))return bad();
 return {commandId:x.commandId,personId:x.personId,expectedRevision:x.expectedRevision as number|null};
}
export function parsePersonResolution(x:unknown,pending:PendingPerson):PersonResolution{
 if(record(x)&&x.status==='confirmed')return {status:'confirmed',receipt:parseSaveReceipt(x.receipt,pending)};
 if(record(x)&&x.status==='closed'&&x.commandId===pending.commandId)return {status:'closed',commandId:pending.commandId};
 return bad();
}
