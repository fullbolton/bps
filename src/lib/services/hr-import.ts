import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import type {HrImportRow} from '@/lib/hr/import-preview';
export const hrImportLabels={new:'Yeni çalışan',same:'Değişiklik yok',changed:'Ad değişikliği',review:'Elle inceleyin',incomplete:'Eksik bilgi'} as const;
export function parseHrImport(raw:unknown,actor:string,tenant:string,rows:HrImportRow[]){
 const r=raw as {schemaVersion?:unknown;actorId?:unknown;tenantId?:unknown;rows?:unknown}|null;
 if(!r||r.schemaVersion!==1||r.actorId!==actor||r.tenantId!==tenant||!Array.isArray(r.rows)||r.rows.length!==rows.length)throw Error('HR_IMPORT_RESPONSE');
 return r.rows.map((value,i)=>{
  if(!value||value.row!==rows[i].row||value.code!==rows[i].code||typeof value.status!=='string'||!Object.hasOwn(hrImportLabels,value.status))throw Error('HR_IMPORT_RESPONSE');
  // Display only the verified classification. Raw employee records never enter preview UI.
  return {row:rows[i].row,code:rows[i].code,status:value.status as keyof typeof hrImportLabels};
 });
}
export async function compareHrImport(client:SupabaseClient<Database>,actor:string,tenant:string,rows:HrImportRow[]){
 const {data,error}=await client.rpc('hr_import_preview_v1',{p_actor:actor,p_tenant:tenant,p_rows:rows}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return parseHrImport(data,actor,tenant,rows);
}
