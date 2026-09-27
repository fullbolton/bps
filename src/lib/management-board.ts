import {isUuid} from '@/lib/operations/pilot-validation';
export type ManagementQuery={owner:string;period:'all'|'today'|'overdue'|'undated';offset:number};
export const managementQuery:ManagementQuery={owner:'all',period:'all',offset:0};
export const MANAGEMENT_PAGE_SIZE=50;
export function validateManagementQuery(input:unknown):ManagementQuery{
 if(!input||typeof input!=='object')throw Error('QUERY');
 const q=input as ManagementQuery;
 if(typeof q.owner!=='string'||!(['all','unassigned'].includes(q.owner)||isUuid(q.owner))||!['all','today','overdue','undated'].includes(q.period)||!Number.isSafeInteger(q.offset)||q.offset<0||q.offset>100000||q.offset%MANAGEMENT_PAGE_SIZE)throw Error('QUERY');
 return {owner:q.owner,period:q.period,offset:q.offset};
}
export function istanbulToday(now=new Date()):string{
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const part=(type:string)=>p.find(x=>x.type===type)!.value;
 return `${part('year')}-${part('month')}-${part('day')}`;
}
export function applyManagementFilters<T extends {eq:(key:string,value:string)=>T;is:(key:string,value:null)=>T;lt:(key:string,value:string)=>T}>(builder:T,q:ManagementQuery,today:string):T{
 let b=builder;
 if(q.owner==='unassigned')b=b.is('assigned_to_user_id',null);
 else if(q.owner!=='all')b=b.eq('assigned_to_user_id',q.owner);
 if(q.period==='today')b=b.eq('due_date',today);
 if(q.period==='overdue')b=b.lt('due_date',today);
 if(q.period==='undated')b=b.is('due_date',null);
 return b;
}
