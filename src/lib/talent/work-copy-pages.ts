import {parseCompareSnapshot,type CompareSnapshot} from './import-compare';
import type {TalentScope} from './people';
import {isUuid} from '@/lib/operations/pilot-validation';
export type ExportCursor={after:string;version:string};
export function validateExportCursor(cursor:ExportCursor|null){
 if(cursor!==null&&(!cursor||!isUuid(cursor.after)||typeof cursor.version!=='string'||!/^\d{1,19}$/.test(cursor.version)))throw Error('TALENT_EXPORT_CURSOR');
 return cursor;
}
export function parseExportPage(value:unknown,scope:TalentScope,cursor:ExportCursor|null){
 validateExportCursor(cursor);
 const fail=():never=>{throw Error('TALENT_EXPORT_RESPONSE');};
 if(!value||typeof value!=='object')return fail();
 const v=value as Record<string,unknown>;
 if(!Array.isArray(v.rows)||v.rows.length>500||!Number.isInteger(v.total)||Number(v.total)<0||Number(v.total)>50000||typeof v.version!=='string'||!/^\d{1,19}$/.test(v.version)||v.after!==(cursor?.after??null)||typeof v.more!=='boolean')return fail();
 if(cursor&&v.version!==cursor.version)throw Error('TALENT_EXPORT_CHANGED');
 const page=parseCompareSnapshot({...v,total:v.rows.length},scope);
 let previous=cursor?.after??'';
 for(const row of page.rows){if(row.id<=previous)return fail();previous=row.id;}
 if(v.more?(page.rows.length!==500||v.next!==previous):(v.next!==null))return fail();
 return {...page,total:Number(v.total),version:v.version,more:v.more,next:v.next as string|null};
}
export async function loadWorkCopy(scope:TalentScope,fetchPage:(cursor:ExportCursor|null)=>Promise<unknown>,signal:AbortSignal,onProgress:(done:number,total:number)=>void):Promise<CompareSnapshot>{
 let cursor:ExportCursor|null=null,version:string|undefined,total:number|undefined,generatedAt='',bytes=0;
 const rows:CompareSnapshot['rows']=[];
 const check=()=>{if(signal.aborted)throw new DOMException('İptal edildi','AbortError');};
 for(let index=0;index<100;index++){
  check();const raw=await fetchPage(cursor);check();
  const page=parseExportPage(raw,scope,cursor);
  if(version!==undefined&&(version!==page.version||total!==page.total))throw Error('TALENT_EXPORT_CHANGED');
  version=page.version;total=page.total;generatedAt||=page.generatedAt;
  bytes+=new TextEncoder().encode(JSON.stringify(page.rows)).length;
  if(bytes>32*1024*1024)throw Error('TALENT_EXPORT_LIMIT');
  rows.push(...page.rows);
  if(rows.length>total||(page.more&&rows.length>=total))throw Error('TALENT_EXPORT_RESPONSE');
  onProgress(rows.length,total);
  if(!page.more){if(rows.length!==total)throw Error('TALENT_EXPORT_RESPONSE');return {...scope,total,generatedAt,rows};}
  cursor={after:page.next!,version};
 }
 throw Error('TALENT_EXPORT_LIMIT');
}
