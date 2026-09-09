export type DailyDashboard={day:string;requests:number;required:number;placed:number;missing:number;openRequests:number;gaps:{id:string;companyId:string;company:string;location:string;position:string;missing:number}[]};
export function parseDailyDashboard(value:unknown):DailyDashboard{
 if(!value||typeof value!=='object')throw Error('Günlük özet okunamadı.');const r=value as DailyDashboard;
 if(typeof r.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!Number.isFinite(Date.parse(r.day))||new Date(r.day).toISOString().slice(0,10)!==r.day)throw Error('Günlük özet okunamadı.');
 for(const n of [r.requests,r.required,r.placed,r.missing,r.openRequests])if(!Number.isSafeInteger(n)||n<0)throw Error('Günlük özet okunamadı.');
 if(!Array.isArray(r.gaps)||r.gaps.length!==Math.min(5,r.openRequests)||r.openRequests>r.requests||r.missing>r.required)throw Error('Günlük özet okunamadı.');
 const seen=new Set<string>();for(const g of r.gaps){if(!g||typeof g.id!=='string'||! /^[0-9a-f-]{36}$/.test(g.id)||seen.has(g.id)||typeof g.companyId!=='string'||! /^[0-9a-f-]{36}$/.test(g.companyId)||typeof g.company!=='string'||typeof g.location!=='string'||typeof g.position!=='string'||!Number.isSafeInteger(g.missing)||g.missing<=0)throw Error('Günlük özet okunamadı.');seen.add(g.id);}
 return r;
}
