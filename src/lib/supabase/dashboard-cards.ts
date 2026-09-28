import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database, ContractRow, DocumentRow, CriticalDateRow} from '@/types/database.types';
import {currentDocumentStatus, isDocumentValidityDate} from '@/lib/document-validity';
type Client = SupabaseClient<Database>;
export type DashboardContract = Pick<ContractRow,'id'|'name'|'company_id'|'status'|'end_date'>;
export type DashboardDocument = Pick<DocumentRow,'id'|'name'|'company_id'|'status'|'storage_path'|'validity_date'>;
export type DashboardDeadline = Pick<CriticalDateRow,'id'|'title'|'deadline_date'|'date_type'|'responsible'>;

export function dashboardDayWindow(day:string) {
 if(!isDocumentValidityDate(day))throw Error('Özet tarihi geçersiz.');
 const now=new Date(day+'T00:00:00Z');
 return {now,until:new Date(now.getTime()+30*86400000).toISOString().slice(0,10)};
}
export function dashboardRemainingDays(date:string,day:string):number {
 if(!isDocumentValidityDate(date))throw Error('Kayıt tarihi geçersiz.');
 return (Date.parse(date+'T00:00:00Z')-dashboardDayWindow(day).now.getTime())/86400000;
}
/** Exact count detects a server cap smaller than the intended card. This is a
 * bounded subset, never an assertion that every matching row was downloaded. */
function cardRows<T extends {id:string}>(result:{data:T[]|null;error:unknown;count:number|null},limit:number):T[] {
 const {data,error,count}=result;
 if(error||!Array.isArray(data)||typeof count!=='number'||!Number.isSafeInteger(count)||count<0||data.length!==Math.min(count,limit)||new Set(data.map(r=>r.id)).size!==data.length)throw Error('Özet yüklenemedi. Yeniden deneyin.');
 return data;
}
export async function selectDashboardContracts(client:Client,day:string):Promise<DashboardContract[]> {
 dashboardDayWindow(day);
 return cardRows(await client.from('contracts').select('id,name,company_id,status,end_date',{count:'exact'})
  .eq('status','aktif').gte('end_date',day).order('end_date',{ascending:true}).order('id',{ascending:true})
  .limit(5).abortSignal(AbortSignal.timeout(15000)),5);
}
export async function selectDashboardDocuments(client:Client,day:string):Promise<DashboardDocument[]> {
 const {until,now}=dashboardDayWindow(day);
 // Match currentDocumentStatus before LIMIT, including undated manual states
 // and missing files. A future-dated file's stale stored state is not an alert.
 const rows=cardRows(await client.from('documents').select('id,name,company_id,status,storage_path,validity_date',{count:'exact'})
  .or(`status.eq.eksik,storage_path.is.null,storage_path.eq."",validity_date.lte.${until},and(validity_date.is.null,status.neq.tam)`)
  .order('updated_at',{ascending:false}).order('id',{ascending:true}).limit(5)
  .abortSignal(AbortSignal.timeout(15000)),5);
 return rows.map(row=>({...row,status:currentDocumentStatus(row,now)}));
}
export async function selectDashboardDeadlines(client:Client,day:string):Promise<DashboardDeadline[]> {
 const {until}=dashboardDayWindow(day);
 return cardRows(await client.from('critical_dates').select('id,title,deadline_date,date_type,responsible',{count:'exact'})
  .lte('deadline_date',until).order('deadline_date',{ascending:true}).order('id',{ascending:true})
  .limit(4).abortSignal(AbortSignal.timeout(15000)),4);
}
/** Resolve only displayed references. Missing RLS-visible names stay absent so
 * the caller can show a per-card error instead of inventing a company label. */
export async function selectDashboardCompanyNames(client:Client,ids:string[]):Promise<Map<string,string>> {
 const names=new Map<string,string>(),unique=[...new Set(ids)];
 const signal=AbortSignal.timeout(15000);
 for(let offset=0;offset<unique.length;offset+=75){
  const keys=unique.slice(offset,offset+75);
  const rows=cardRows(await client.from('companies').select('id,name',{count:'exact'}).in('id',keys)
   .order('id',{ascending:true}).limit(keys.length).abortSignal(signal),keys.length);
  for(const row of rows){if(!keys.includes(row.id))throw Error('Firma kapsamı doğrulanamadı.');names.set(row.id,row.name);}
 }
 return names;
}
