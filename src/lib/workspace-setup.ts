export type WorkspaceSetup={tenantId:string;name:string;today:string;companies:number;locations:number;members:number;workers:number;requests:number;assignments:number};
export function parseWorkspaceSetup(value:unknown,tenantId:string):WorkspaceSetup{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Kurulum bilgileri doğrulanamadı.');
 const r=value as Record<string,unknown>;
 if(r.tenantId!==tenantId||typeof r.name!=='string'||!r.name.trim()||typeof r.today!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.today)||!Number.isFinite(Date.parse(r.today))||new Date(r.today).toISOString().slice(0,10)!==r.today)throw Error('Kurulum bilgileri doğrulanamadı.');
 for(const k of ['companies','locations','members','workers','requests','assignments'])if(typeof r[k]!=='number'||!Number.isSafeInteger(r[k])||r[k]<0)throw Error('Kurulum bilgileri doğrulanamadı.');
 return {tenantId,name:r.name,today:r.today,companies:r.companies as number,locations:r.locations as number,members:r.members as number,workers:r.workers as number,requests:r.requests as number,assignments:r.assignments as number};
}
