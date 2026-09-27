import {shiftsOverlap,type ShiftWindow} from './shift-window';
import {parseWeeklyPlan,type WeeklyPlan,type WeeklyRequest} from './weekly-plan';
import {isUuid} from './pilot-validation';
import type {AttendanceRecord} from './pilot-types';
export type AttendanceWeek=Omit<WeeklyPlan,'requests'>&{requests:(WeeklyRequest&{attendance:AttendanceRecord[]})[]};
export function parseAttendanceWeek(value:unknown,companyId:string,start:string):AttendanceWeek{
  const plan=parseWeeklyPlan(value,companyId,start) as AttendanceWeek;
  const ids=new Set<string>(),presentDays=new Map<string,ShiftWindow[]>();
  const bad=()=>{throw new Error('Haftalık yoklama özeti alınamadı.');};
  for(const r of plan.requests){
    if(!Array.isArray(r.attendance))return bad();
    for(const a of r.attendance){
      if(!a||!isUuid(a.id)||!isUuid(a.workerId)||!['unreported','present','absent'].includes(a.status)||!Number.isInteger(a.revision)||a.revision<0||a.revision>2147483647||typeof a.removed!=='boolean'||ids.has(a.id))return bad();
      ids.add(a.id);if(ids.size>20000)return bad();
      if(a.status==='present'){
        const window={workDate:r.workDate,clock:r.shift??null};const prior=presentDays.get(a.workerId)??[];if(prior.some(previous=>shiftsOverlap(previous,window)))return bad();presentDays.set(a.workerId,[...prior,window]);
      }
    }
    const active=r.attendance.filter(a=>!a.removed);
    if(active.length!==r.assignments.length||!r.assignments.every(a=>active.some(x=>x.id===a.id&&x.workerId===a.workerId)))return bad();
  }
  return plan;
}
export function attendanceTotals(rows:AttendanceWeek['requests']){
  const t={present:0,absent:0,unreported:0,cancelledPresent:0};
  for(const r of rows)for(const a of r.attendance){
    if(a.status==='present'){t.present++;if(r.lifecycle==='cancelled')t.cancelledPresent++;}
    else if(a.status==='absent')t.absent++;
    else if(!a.removed)t.unreported++;
  }
  return t;
}
