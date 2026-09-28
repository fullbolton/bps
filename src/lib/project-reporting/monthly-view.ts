import {isUuid} from '@/lib/operations/pilot-validation';
type Totals={records:number;minutes:number;people:number;days:number;branches:number};
export type MonthlyReport={tenantId:string;projectId:string;name:string;month:string;status:'open'|'closed';pending:number;totals:Totals;offset:number;rows:{id:string;name:string;records:number;minutes:number;people:number;days:number}[]};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
export function parseMonthlyReport(v:unknown,tenant:string,project:string,month:string,offset:number):MonthlyReport{
 if(!obj(v)||v.tenantId!==tenant||v.projectId!==project||v.month!==month||v.offset!==offset||typeof v.name!=='string'||!['open','closed'].includes(String(v.status))||!num(v.pending)||!obj(v.totals)||!Array.isArray(v.rows))throw Error('REPORT_RESPONSE');
 const t=v.totals,rows=v.rows;
 if(!['records','minutes','people','days','branches'].every(k=>num(t[k]))||Number(t.days)>31||Number(t.people)>Number(t.records)||Number(t.branches)>Number(t.records)||Number(t.minutes)>Number(t.records)*1440||v.rows.length!==Math.min(50,Math.max(0,Number(t.branches)-offset)))throw Error('REPORT_RESPONSE');
 const ids=new Set();for(const r of v.rows){if(!obj(r)||!isUuid(r.id)||ids.has(r.id)||typeof r.name!=='string'||!['records','minutes','people','days'].every(k=>num(r[k]))||Number(r.records)<1||Number(r.minutes)>Number(r.records)*1440||Number(r.people)>Number(r.records)||Number(r.days)>31)throw Error('REPORT_RESPONSE');ids.add(r.id);}
 if(offset===0&&Number(t.branches)<=50&&['records','minutes'].some(k=>rows.reduce((sum,r)=>sum+Number(r[k]),0)!==t[k]))throw Error('REPORT_RESPONSE');
 return v as MonthlyReport;
}
export function workDuration(minutes:number){return `${Math.floor(minutes/60).toLocaleString('tr-TR')} sa${minutes%60?` ${minutes%60} dk`:''}`;}
