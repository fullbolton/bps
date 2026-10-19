import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
export function parseHrPrivateDocuments(raw:unknown,actor:string,tenant:string,employee:string){
 const r=raw as Record<string,unknown>|null;
 if(![actor,tenant,employee].every(isUuid)||!r||r.schemaVersion!==1||r.actorId!==actor||r.tenantId!==tenant||r.employeeId!==employee||!Array.isArray(r.documents)||r.documents.length>50||typeof r.hasMore!=='boolean'||(r.hasMore&&r.documents.length!==50))throw Error('HR_DOCUMENT_RESPONSE');
 const seen=new Set<string>();
 const documents=r.documents.map(d=>{
  if(!d||!isUuid(d.id)||seen.has(d.id)||!isUuid(d.employmentId)||typeof d.title!=='string'||!d.title.trim()||d.title.length>160||typeof d.expired!=='boolean'||typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt)))throw Error('HR_DOCUMENT_ROW');
  if(d.validityDate!==null&&(typeof d.validityDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.validityDate)||!Number.isFinite(Date.parse(d.validityDate))||new Date(d.validityDate).toISOString().slice(0,10)!==d.validityDate))throw Error('HR_DOCUMENT_ROW');
  if(d.validityDate===null&&d.expired)throw Error('HR_DOCUMENT_ROW');seen.add(d.id);
  return {id:d.id as string,employmentId:d.employmentId as string,title:d.title as string,validityDate:d.validityDate as string|null,expired:d.expired as boolean,createdAt:d.createdAt as string};
 });
 return {documents,hasMore:r.hasMore};
}
export async function loadHrPrivateDocuments(client:SupabaseClient<Database>,actor:string,tenant:string,employee:string,after?:string){
 const {data,error}=await client.rpc('hr_private_documents_v1',{p_actor:actor,p_tenant:tenant,p_employee:employee,p_after:after}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrPrivateDocuments(data,actor,tenant,employee);
}
