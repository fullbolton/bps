import {isUuid} from './pilot-validation';
export type LocationUpdate={companyId:string;id:string;expectedRevision:number;name:string;city:string};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const validText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\x00-\x1f\x7f]/.test(v);
export function validateLocationUpdate(value:unknown):LocationUpdate{
  if(!object(value)||!isUuid(value.companyId)||!isUuid(value.id)||!Number.isInteger(value.expectedRevision)||typeof value.expectedRevision!=='number'||value.expectedRevision<0||value.expectedRevision>2147483646||!validText(value.name,160)||!validText(value.city,80))throw new Error('Şube bilgileri geçersiz. Ad, il ve kayıt sürümünü kontrol edin.');
  return {companyId:value.companyId,id:value.id,expectedRevision:value.expectedRevision,name:value.name.trim(),city:value.city.trim()};
}
export function parseLocationUpdate(value:unknown,commandId:string,input:LocationUpdate){
  const p=validateLocationUpdate(input);
  if(!isUuid(commandId)||!object(value)||value.commandId!==commandId||value.id!==p.id||value.companyId!==p.companyId||value.name!==p.name||value.city!==p.city||value.previousRevision!==p.expectedRevision||value.revision!==p.expectedRevision+1||!validText(value.previousName,160)||!validText(value.previousCity,80))throw new Error('Şube güncelleme sonucu doğrulanamadı. Aynı işlemi yeniden kontrol edin.');
  return {id:p.id,companyId:p.companyId,commandId,name:p.name,city:p.city,previousName:value.previousName,previousCity:value.previousCity,previousRevision:p.expectedRevision,revision:p.expectedRevision+1};
}
