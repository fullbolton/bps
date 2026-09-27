import type { PilotBoard } from './pilot-types';
export type DailyFocus = 'all' | 'open' | 'unreported' | 'absent';
export const DAILY_FOCUS_LABELS: Record<DailyFocus,string> = {all:'Tüm talepler',open:'Personel eksik',unreported:'Yoklama bekliyor',absent:'Gelmedi'};
type Request = PilotBoard['requests'][number];
export function requestProgress(request: Request) {
  const active = request.lifecycle === 'active';
  const statuses = new Map(request.attendance.filter(row=>!row.removed).map(row=>[row.id,row.status]));
  const present = request.assignments.filter(row=>statuses.get(row.id)==='present').length;
  const absent = request.assignments.filter(row=>statuses.get(row.id)==='absent').length;
  return {open:active?Math.max(0,request.requiredCount-request.assignments.length):0,present,absent,unreported:request.assignments.length-present-absent};
}
export function matchesDailyFocus(request:Request,focus:DailyFocus) {
  if(focus==='all')return true;
  return request.lifecycle==='active' && requestProgress(request)[focus]>0;
}
const fold=(value:string)=>value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
export function dailyRequestSearchText(request:Request,location:PilotBoard['locations'][number]|undefined,workerNames:ReadonlyMap<string,string>) {
  return fold([location?.name,location?.city,request.position,request.serviceLine,...request.assignments.map(a=>workerNames.get(a.workerId))].filter(Boolean).join(' '));
}
export function matchesDailySearch(text:string,query:string) {return fold(query).trim().split(/\s+/).every(word=>text.includes(word));}
