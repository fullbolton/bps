import {historyOffset,parseImportHistory} from '@/lib/talent/import-history';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {checkTalentScope} from '@/lib/talent/people';
import {importReference,validateImportRequest,parseImportStatus,parseImportRow,parseImportRecovery} from '@/lib/talent/import-batches';
import {readImportHistory,prepareImport,readImport,applyImportRow,cancelImport,recoverImport} from '@/lib/supabase/talent-import';
type Client=SupabaseClient<Database>;
export async function prepareTalentImport(c:Client,scope:unknown,input:unknown){const s=checkTalentScope(scope),r=validateImportRequest(input);const status=parseImportStatus(await prepareImport(c,s,r),s,r);if(status.rows.some(row=>!r.rows.some(source=>source.number===row.number)))throw Error('TALENT_IMPORT_RESPONSE');return status;}
export async function loadTalentImport(c:Client,scope:unknown,reference:unknown){const s=checkTalentScope(scope),r=importReference(reference);return parseImportStatus(await readImport(c,s,r.batchId),s,r);}
export async function applyTalentImportRow(c:Client,scope:unknown,reference:unknown,number:number){const s=checkTalentScope(scope),r=importReference(reference);if(!Number.isInteger(number)||number<1||number>50001)throw Error('TALENT_IMPORT_VALIDATION');return parseImportRow(await applyImportRow(c,s,r.batchId,number),number);}
export async function cancelTalentImport(c:Client,scope:unknown,reference:unknown){const s=checkTalentScope(scope),r=importReference(reference);return parseImportStatus(await cancelImport(c,s,r.batchId),s,r);}
export async function recoverTalentImport(c:Client,scope:unknown,reference:unknown,close=false){const s=checkTalentScope(scope),r=importReference(reference);return parseImportRecovery(await recoverImport(c,s,r,close),s,r);}
export async function loadTalentImportHistory(c:Client,scope:unknown,offset:unknown){const s=checkTalentScope(scope),page=historyOffset(offset);return parseImportHistory(await readImportHistory(c,s,page),s,page);}
