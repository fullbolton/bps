import {isWorkDate} from './daily-demand';
import {isUuid} from './pilot-validation';
export type WeeklyRequest={id:string;locationId:string;locationName:string;city:string;workDate:string;serviceLine:string;position:string;requiredCount:number;lifecycle:'active'|'cancelled';assignments:{id:string;workerId:string;name:string}[]};
export type WeeklyPlan={companyId:string;companyName:string;weekStart:string;generatedAt:string;requests:WeeklyRequest[]};
export function addDays(date:string,n:number):string{
  if(!isWorkDate(date)||!Number.isInteger(n))throw new Error('Geçersiz tarih.');
  const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
}
export function weekStart(date:string):string{
  if(!isWorkDate(date)||date<'2000-01-01'||date>'2100-12-31')throw new Error('2000–2100 arasında bir gün seçin.');
  return addDays(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7));
}
const text=(x:unknown,max:number):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function parseWeeklyPlan(value:unknown,companyId:string,start:string):WeeklyPlan{
  const bad=()=>{throw new Error('Haftalık plan doğrulanamadı.');};
  if(!isUuid(companyId)||!isWorkDate(start)||!object(value)||value.companyId!==companyId||value.weekStart!==start||!text(value.companyName,500)||typeof value.generatedAt!=='string'||!Number.isFinite(Date.parse(value.generatedAt))||!Array.isArray(value.requests)||value.requests.length>5000)return bad();
  const requestIds=new Set(),assignmentIds=new Set(),workerDays=new Set();
  for(const r of value.requests){
    if(!object(r)||!isUuid(r.id)||requestIds.has(r.id)||!isUuid(r.locationId)||!text(r.locationName,160)||!text(r.city,80)||!isWorkDate(r.workDate)||r.workDate<start||r.workDate>=addDays(start,7)||!text(r.serviceLine,80)||!text(r.position,80)||typeof r.requiredCount!=='number'||!Number.isInteger(r.requiredCount)||r.requiredCount<1||r.requiredCount>100||(r.lifecycle!=='active'&&r.lifecycle!=='cancelled')||!Array.isArray(r.assignments)||r.assignments.length>r.requiredCount||(r.lifecycle==='cancelled'&&r.assignments.length>0))return bad();
    requestIds.add(r.id);
    for(const a of r.assignments){
      if(!object(a)||!isUuid(a.id)||!isUuid(a.workerId)||!text(a.name,160)||assignmentIds.has(a.id)||workerDays.has(a.workerId+':'+r.workDate))return bad();
      assignmentIds.add(a.id);workerDays.add(a.workerId+':'+r.workDate);
    }
  }
  return value as WeeklyPlan;
}
export function weeklyTotals(rows:WeeklyRequest[]){
  return rows.reduce((t,r)=>r.lifecycle==='cancelled'?{...t,cancelled:t.cancelled+1}:{...t,requests:t.requests+1,required:t.required+r.requiredCount,assigned:t.assigned+r.assignments.length,open:t.open+r.requiredCount-r.assignments.length},{requests:0,cancelled:0,required:0,assigned:0,open:0});
}
const csvCell=(value:unknown)=>{
  let s=String(value??'');
  // Spreadsheet formula prefixes must remain text even after leading whitespace.
  if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
};
export function weeklyCsv(plan:WeeklyPlan,includeCancelled:boolean):string{
  const rows=[['Firma','Hafta başlangıcı','Hafta sonu','Veri alınma zamanı','Kapsam','Gün','Şube','İl','Hizmet','Pozisyon','Durum','Talep edilen kişi','Atanan kişi','Aktif açık','Atanan personel']];
  for(const r of plan.requests.filter(r=>includeCancelled||r.lifecycle==='active'))rows.push([
    plan.companyName,plan.weekStart,addDays(plan.weekStart,6),plan.generatedAt,includeCancelled?'İptaller dahil':'Aktif talepler',r.workDate,r.locationName,r.city,r.serviceLine,r.position,r.lifecycle==='cancelled'?'İptal':'Aktif',String(r.requiredCount),String(r.assignments.length),String(r.lifecycle==='cancelled'?0:r.requiredCount-r.assignments.length),r.assignments.map(a=>a.name).join(' | ')
  ]);
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n';
}
