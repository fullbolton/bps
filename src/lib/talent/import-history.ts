import {checkTalentScope,type TalentScope} from './people';
import {importReference,type ImportReference} from './import-batches';
export type ImportHistoryItem=ImportReference&{createdAt:string;pending:number};
export type ImportHistory=TalentScope&{offset:number;total:number;rows:ImportHistoryItem[]};
export function historyOffset(x:unknown):number{if(typeof x!=='number'||!Number.isInteger(x)||x<0||x>1000000||x%20!==0)throw Error('TALENT_IMPORT_VALIDATION');return x;}
export function parseImportHistory(input:unknown,scope:TalentScope,offset:number):ImportHistory{
 const s=checkTalentScope(scope);historyOffset(offset);const bad=():never=>{throw Error('TALENT_IMPORT_RESPONSE');};
 if(!input||typeof input!=='object'||Array.isArray(input))return bad();
 const x=input as Record<string,unknown>;
 if(x.actorId!==s.actorId||x.tenantId!==s.tenantId||x.offset!==offset||typeof x.total!=='number'||!Number.isSafeInteger(x.total)||x.total<0||!Array.isArray(x.rows)||x.rows.length!==Math.min(20,Math.max(0,x.total-offset)))return bad();
 const ids=new Set<string>();const rows=x.rows.map(v=>{
  const ref=importReference(v);if(ids.has(ref.batchId)||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||typeof v.pending!=='number'||!Number.isInteger(v.pending)||v.pending<0||v.pending>ref.total)return bad();
  ids.add(ref.batchId);return {...ref,createdAt:v.createdAt,pending:v.pending};
 });return {...s,offset,total:x.total,rows};
}
