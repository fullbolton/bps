import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import type {HrImportRow} from '@/lib/hr/import-preview';
export const hrImportLabels={new:'Yeni çalışan',same:'Değişiklik yok',changed:'Ad değişikliği',review:'Elle inceleyin',incomplete:'Eksik bilgi'} as const;
export function parseHrImport(raw:unknown,actor:string,tenant:string,rows:HrImportRow[]){
 const r=raw as {schemaVersion?:unknown;actorId?:unknown;tenantId?:unknown;rows?:unknown}|null;
 if(!r||r.schemaVersion!==1||r.actorId!==actor||r.tenantId!==tenant||!Array.isArray(r.rows)||r.rows.length!==rows.length)throw Error('HR_IMPORT_RESPONSE');
 return r.rows.map((value,i)=>{
  if(!value||value.row!==rows[i].row||value.code!==rows[i].code||typeof value.status!=='string'||!Object.hasOwn(hrImportLabels,value.status))throw Error('HR_IMPORT_RESPONSE');
  const existingName=typeof value.existing?.name==='string'&&value.existing.name.length<=160?value.existing.name:null;
  if(value.status==='changed'&&!existingName)throw Error('HR_IMPORT_RESPONSE');
  return {row:rows[i].row,code:rows[i].code,status:value.status as keyof typeof hrImportLabels,existingName};
 });
}
export async function compareHrImport(client:SupabaseClient<Database>,actor:string,tenant:string,rows:HrImportRow[]){
 const {data,error}=await client.rpc('hr_import_review_v1',{p_actor:actor,p_tenant:tenant,p_rows:rows}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;const token=(data as {token?:unknown}|null)?.token;if(typeof token!=='string'||!/^[a-f0-9]{32}$/.test(token))throw Error('HR_IMPORT_RESPONSE');return {token,rows:parseHrImport(data,actor,tenant,rows)};
}

export function prepareHrImport(actor:string,tenant:string,command:string,source:string,rows:HrImportRow[],review:Awaited<ReturnType<typeof compareHrImport>>,selected:number[]){
 if(![actor,tenant,command].every(isUuid)||!/^[a-f0-9]{64}$/.test(source)||!/^[a-f0-9]{32}$/.test(review.token)||!selected.length||new Set(selected).size!==selected.length||selected.some(n=>!review.rows.some(r=>r.row===n&&(r.status==='new'||r.status==='changed'))))throw Error('HR_IMPORT_DECISION');
 return Object.freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_source:source,p_rows:rows.map(r=>({...r})),p_token:review.token,p_selected:[...selected]});
}
export async function saveHrImport(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareHrImport>){
 const {data,error}=await client.rpc('hr_import_commit_v1',intent).abortSignal(AbortSignal.timeout(20000));if(error)throw error;
 const r=data as {schemaVersion?:unknown;actorId?:unknown;tenantId?:unknown;commandId?:unknown;source?:unknown;rows?:unknown}|null;
 if(!r||r.schemaVersion!==1||r.actorId!==intent.p_actor||r.tenantId!==intent.p_tenant||r.commandId!==intent.p_command||r.source!==intent.p_source||!Array.isArray(r.rows)||r.rows.length!==intent.p_selected.length)throw Error('HR_RECEIPT');
 const seen=new Set<number>();for(const row of r.rows){if(!row||!intent.p_selected.includes(row.row)||seen.has(row.row)||!isUuid(row.employeeId)||!['created','updated'].includes(row.action))throw Error('HR_RECEIPT');seen.add(row.row);}
 return r.rows.length;
}
