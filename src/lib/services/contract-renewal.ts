import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {transferId} from '@/lib/task-transfer';
import {parseRenewalSnapshot,parseRenewalResult,validateRenewalCommand} from '@/lib/contract-renewal';
import {readRenewal,writeRenewal,type RenewalScope} from '@/lib/supabase/contract-renewal';
type Client=SupabaseClient<Database>;
function checked(s:RenewalScope){return {actorId:transferId(s.actorId),tenantId:transferId(s.tenantId)};}
export async function loadRenewal(client:Client,scope:RenewalScope,contractId:string){return parseRenewalSnapshot(await readRenewal(client,checked(scope),transferId(contractId)),contractId);}
export async function createRenewal(client:Client,scope:RenewalScope,input:unknown){const c=validateRenewalCommand(input);return parseRenewalResult(await writeRenewal(client,checked(scope),c),c);}
