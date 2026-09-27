import { isUuid } from './pilot-validation';
export type CommandResolution={id:string;status:'confirmed'|'closed'|'unknown'};
export function validateCommandIds(ids:unknown):string[]{
  if(!Array.isArray(ids)||ids.length>50||!ids.every(isUuid)||new Set(ids).size!==ids.length)throw new Error('İşlem listesi doğrulanamadı.');
  return ids;
}
export function parseCommandResolutions(ids:string[],value:unknown):CommandResolution[]{
  validateCommandIds(ids);
  if(!Array.isArray(value)||value.length!==ids.length||value.some(r=>!r||typeof r!=='object'||!ids.includes(r.id)||!['confirmed','closed','unknown'].includes(r.status))||new Set(value.map(r=>r.id)).size!==ids.length)throw new Error('İşlem sonuçları doğrulanamadı; bekleyen kayıtlar korundu.');
  return value;
}
