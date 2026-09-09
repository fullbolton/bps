import {isUuid} from './pilot-validation';
export type DirectoryQuery={kind:'locations'|'workers';companyId:string|null;search:string;status:'all'|'active'|'inactive';offset:number};
export type DirectoryRow={id:string;name:string;code:string|null;city:string|null;workerKind:'idp'|'sabit'|null;active:boolean;revision:number};
export type DirectoryPage=DirectoryQuery&{total:number;generatedAt:string;rows:DirectoryRow[]};
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const text=(x:unknown,max:number):x is string=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
export function validateDirectoryQuery(value:unknown):DirectoryQuery{
  if(!object(value)||(value.kind!=='locations'&&value.kind!=='workers')||(value.kind==='locations'?!isUuid(value.companyId):value.companyId!==null)||typeof value.search!=='string'||value.search.length>160||!['all','active','inactive'].includes(value.status as string)||typeof value.offset!=='number'||!Number.isInteger(value.offset)||value.offset<0||value.offset>1000000||value.offset%50!==0)throw new Error('Dizin sorgusu geçersiz.');
  return {kind:value.kind,companyId:value.companyId as string|null,search:value.search.trim(),status:value.status as DirectoryQuery['status'],offset:value.offset};
}
export function parseDirectoryPage(value:unknown,query:DirectoryQuery):DirectoryPage{
  const q=validateDirectoryQuery(query),bad=()=>{throw new Error('Dizin verisi doğrulanamadı.');};
  if(!object(value)||Object.entries(q).some(([k,v])=>value[k]!==v)||typeof value.total!=='number'||!Number.isInteger(value.total)||value.total<0||value.total>1000050||typeof value.generatedAt!=='string'||!Number.isFinite(Date.parse(value.generatedAt))||!Array.isArray(value.rows)||value.rows.length!==Math.min(50,Math.max(0,value.total-q.offset)))return bad();
  const ids=new Set<string>();
  for(const r of value.rows){
    if(!object(r)||!isUuid(r.id)||ids.has(r.id)||!text(r.name,160)||typeof r.active!=='boolean'||typeof r.revision!=='number'||!Number.isInteger(r.revision)||r.revision<0||r.revision>2147483647||(q.status!=='all'&&r.active!==(q.status==='active')))return bad();
    ids.add(r.id);
    if(q.kind==='locations'){
      if((r.code!==null&&(typeof r.code!=='string'||!/^[A-Za-z0-9_-]{1,40}$/.test(r.code)))||!text(r.city,80)||r.workerKind!==null)return bad();
    }else if(!text(r.code,40)||r.city!==null||(r.workerKind!=='idp'&&r.workerKind!=='sabit'))return bad();
  }
  return value as DirectoryPage;
}

export type DirectoryActivation={kind:DirectoryQuery['kind'];id:string;expectedRevision:number;active:boolean};
export function validateDirectoryActivation(value:unknown):DirectoryActivation{
  if(!object(value)||(value.kind!=='locations'&&value.kind!=='workers')||!isUuid(value.id)||typeof value.expectedRevision!=='number'||!Number.isInteger(value.expectedRevision)||value.expectedRevision<0||value.expectedRevision>2147483646||typeof value.active!=='boolean')throw new Error('Aktiflik bilgisi geçersiz.');
  return {kind:value.kind,id:value.id,expectedRevision:value.expectedRevision,active:value.active};
}
export function parseDirectoryActivation(value:unknown,id:string,payload:DirectoryActivation){
  if(!object(value)||value.id!==payload.id||value.commandId!==id||value.kind!==payload.kind||value.active!==payload.active||value.revision!==payload.expectedRevision+1||value.previousRevision!==payload.expectedRevision||typeof value.previousActive!=='boolean')throw new Error('Aktiflik sonucu doğrulanamadı. Aynı işlemi yeniden deneyin.');
  return {id:payload.id,commandId:id};
}
