import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {parseTransferDirectory,parseTransferPreview,parseTransferResult,validateTransferCommand,transferId} from '@/lib/task-transfer';
import {readTransferDirectory,readTransferPreview,writeTransfer,type TransferScope} from '@/lib/supabase/task-transfer';
type Client=SupabaseClient<Database>;
function checked(scope:TransferScope){return {actorId:transferId(scope.actorId),tenantId:transferId(scope.tenantId)};}
export async function loadTransferDirectory(client:Client,scope:TransferScope){return parseTransferDirectory(await readTransferDirectory(client,checked(scope)));}
export async function loadTransferPreview(client:Client,scope:TransferScope,sourceId:string){return parseTransferPreview(await readTransferPreview(client,checked(scope),transferId(sourceId)),sourceId);}
export async function submitTransfer(client:Client,scope:TransferScope,input:unknown){
  const command=validateTransferCommand(input);
  return parseTransferResult(await writeTransfer(client,checked(scope),command),command);
}
