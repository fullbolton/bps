import {weekStart} from './weekly-plan';
import {parseAttendanceWeek,type AttendanceWeek} from './weekly-attendance';
export type ChecklistFilter='all'|'absence'|'open'|'unreported';
export type ChecklistItem={id:string;locationName:string;city:string;position:string;serviceLine:string;open:number;absent:number;unreported:number;required:number;assigned:number};
export type OperationsChecklist={companyId:string;companyName:string;date:string;asOfDay:string;generatedAt:string;items:ChecklistItem[]};
export function buildOperationsChecklist(value:AttendanceWeek,date:string):OperationsChecklist{
  const plan=parseAttendanceWeek(value,value.companyId,weekStart(date));
  const asOfDay=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(new Date(plan.generatedAt));
  const items:ChecklistItem[]=[];
  for(const r of plan.requests){
    if(r.workDate!==date||r.lifecycle!=='active')continue;
    const active=r.attendance.filter(a=>!a.removed);
    const open=r.requiredCount-r.assignments.length;
    const absent=date<=asOfDay?active.filter(a=>a.status==='absent').length:0;
    const unreported=date<=asOfDay?active.filter(a=>a.status==='unreported').length:0;
    if(open||absent||unreported)items.push({id:r.id,locationName:r.locationName,city:r.city,position:r.position,serviceLine:r.serviceLine,open,absent,unreported,required:r.requiredCount,assigned:r.assignments.length});
  }
  const priority=(r:ChecklistItem)=>r.absent?0:r.open?1:2;
  items.sort((a,b)=>priority(a)-priority(b)||a.locationName.localeCompare(b.locationName,'tr')||a.position.localeCompare(b.position,'tr')||a.id.localeCompare(b.id));
  return {companyId:plan.companyId,companyName:plan.companyName,date,asOfDay,generatedAt:plan.generatedAt,items};
}
export function filterChecklist(items:ChecklistItem[],kind:ChecklistFilter,search:string):ChecklistItem[]{
  const query=search.trim().toLocaleLowerCase('tr-TR');
  return items.filter(r=>(kind==='all'||(kind==='absence'?r.absent>0:kind==='open'?r.open>0:r.unreported>0))&&(!query||[r.locationName,r.city,r.position,r.serviceLine].some(s=>s.toLocaleLowerCase('tr-TR').includes(query))));
}
export function checklistTotals(items:ChecklistItem[]){
  return items.reduce((t,r)=>({requests:t.requests+1,open:t.open+r.open,absent:t.absent+r.absent,unreported:t.unreported+r.unreported}),{requests:0,open:0,absent:0,unreported:0});
}
