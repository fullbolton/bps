import {importContacts} from './import-contacts';
import {extendedPersonFields,extendedImportFields} from './import-fields';
import {isUuid} from '@/lib/operations/pilot-validation';
import {checkTalentScope,emptyPerson,validatePersonInput,type TalentScope} from './people';
export type ImportFieldKey='name'|'city'|'phone'|'email'|'district'|'skills'|'regions';
export type ImportSource={name:string;city:string;phone:string;email:string;district?:string;skills?:string;regions?:string};
export type ImportBatchRow={number:number;kind:'hold'}|{number:number;kind:'new';source:ImportSource}|{number:number;kind:'existing';source:ImportSource;targetId:string;expectedRevision:number;fields:ImportFieldKey[]};
export type ImportReference={batchId:string;sourceHash:string;total:number};
export type ImportRequest=ImportReference&{rows:ImportBatchRow[]};
export type ImportRowStatus='pending'|'created'|'updated'|'reverted'|'unchanged'|'held'|'blocked'|'cancelled';
export type ImportRowResult={number:number;status:ImportRowStatus;result:null|{personId:string;revision:number}|{code:string}};
export type ImportBatchStatus=ImportReference&TalentScope&{rows:ImportRowResult[]};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const integer=(x:unknown,min:number,max:number):x is number=>typeof x==='number'&&Number.isInteger(x)&&x>=min&&x<=max;
const fail=():never=>{throw Error('TALENT_IMPORT_RESPONSE');};
export function importReference(x:unknown):ImportReference{
 if(!object(x)||!isUuid(x.batchId)||typeof x.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(x.sourceHash)||!integer(x.total,1,500))return fail();
 return {batchId:x.batchId,sourceHash:x.sourceHash,total:x.total};
}
export function validateImportRequest(x:unknown):ImportRequest{
 const ref=importReference(x);if(!object(x)||!Array.isArray(x.rows)||x.rows.length!==ref.total)return fail();
 const numbers=new Set<number>(),targets=new Set<string>();
 const rows:ImportBatchRow[]=x.rows.map(r=>{
  if(!object(r)||!integer(r.number,1,50001)||numbers.has(r.number))return fail();numbers.add(r.number);
  if(r.kind==='hold'){if(Object.keys(r).some(k=>!['number','kind'].includes(k)))return fail();return {number:r.number,kind:'hold'};}
  if(!['new','existing'].includes(String(r.kind))||!object(r.source)||Object.keys(r.source).some(k=>!['name','city','phone','email',...extendedImportFields].includes(k))||['name','city','phone','email'].some(k=>typeof (r.source as Record<string,unknown>)[k]!=='string'))return fail();
  if(extendedImportFields.some(k=>k in (r.source as Record<string,unknown>)&&typeof (r.source as Record<string,unknown>)[k]!=='string'))return fail();
  const s=r.source as ImportSource;
  validatePersonInput({...emptyPerson,name:s.name,city:s.city||null,...extendedPersonFields(s),contacts:importContacts(s)});
  const source:ImportSource={name:s.name,city:s.city,phone:s.phone,email:s.email,...Object.fromEntries(extendedImportFields.filter(k=>k in s).map(k=>[k,s[k]]))};
  if(r.kind==='new'){if(Object.keys(r).some(k=>!['number','kind','source'].includes(k)))return fail();return {number:r.number,kind:'new',source};}
  if(Object.keys(r).some(k=>!['number','kind','source','targetId','expectedRevision','fields'].includes(k))||!isUuid(r.targetId)||targets.has(r.targetId)||!integer(r.expectedRevision,0,2147483646)||!Array.isArray(r.fields)||r.fields.length>7||new Set(r.fields).size!==r.fields.length||r.fields.some(k=>typeof k!=='string'||!['name','city','phone','email',...extendedImportFields].includes(k)||!source[k as ImportFieldKey]?.trim()))return fail();
  targets.add(r.targetId);return {number:r.number,kind:'existing',source,targetId:r.targetId,expectedRevision:r.expectedRevision,fields:r.fields as ImportFieldKey[]};
 });
 if(new TextEncoder().encode(JSON.stringify(rows)).length>1048576)throw Error('TALENT_IMPORT_LIMIT');
 return {...ref,rows};
}
export function parseImportRow(x:unknown,number?:number):ImportRowResult{
 if(!object(x)||!integer(x.number,1,50001)||(number!==undefined&&x.number!==number)||!['pending','created','updated','reverted','unchanged','held','blocked','cancelled'].includes(String(x.status)))return fail();
 const status=x.status as ImportRowStatus;
 if(['created','updated','reverted','unchanged'].includes(status)){
  if(!object(x.result)||!isUuid(x.result.personId)||!integer(x.result.revision,0,2147483647)||(status==='created'&&x.result.revision!==0)||(['updated','reverted'].includes(status)&&x.result.revision<1))return fail();
  return {number:x.number,status,result:{personId:x.result.personId,revision:x.result.revision}};
 }
 if(status==='blocked'){
  if(!object(x.result)||!['TALENT_IMPORT_MATCH','TALENT_CONFLICT','TALENT_NOT_FOUND','TALENT_VALIDATION','TALENT_IMPORT_VALIDATION'].includes(String(x.result.code)))return fail();
  return {number:x.number,status,result:{code:String(x.result.code)}};
 }
 if(x.result!==null)return fail();return {number:x.number,status,result:null};
}
export function parseImportStatus(x:unknown,scope:TalentScope,reference:ImportReference):ImportBatchStatus{
 const s=checkTalentScope(scope),ref=importReference(reference);
 if(!object(x)||x.actorId!==s.actorId||x.tenantId!==s.tenantId||x.batchId!==ref.batchId||x.sourceHash!==ref.sourceHash||x.total!==ref.total||!Array.isArray(x.rows)||x.rows.length!==ref.total)return fail();
 const rows=x.rows.map(r=>parseImportRow(r));if(new Set(rows.map(r=>r.number)).size!==rows.length)return fail();
 return {...s,...ref,rows};
}
export type ImportRecovery={kind:'batch';data:ImportBatchStatus}|({kind:'closed'|'unknown'}&ImportReference&TalentScope);
export function parseImportRecovery(x:unknown,scope:TalentScope,reference:ImportReference):ImportRecovery{
 const s=checkTalentScope(scope),ref=importReference(reference);
 if(!object(x))return fail();if(x.kind==='batch')return {kind:'batch',data:parseImportStatus(x.data,s,ref)};
 if(!['closed','unknown'].includes(String(x.kind))||x.batchId!==ref.batchId||x.sourceHash!==ref.sourceHash||x.total!==ref.total||x.actorId!==s.actorId||x.tenantId!==s.tenantId)return fail();
 return {...s,...ref,kind:x.kind as 'closed'|'unknown'};
}
