import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {parseHrTransferOptions,prepareHrLocationTransfer,parseHrLocationTransferReceipt} from './hr-scoped-transfer';
export async function loadHrTransferOptions(client:SupabaseClient<Database>,actor:string,tenant:string,employee:string,after?:string){
 const {data,error}=await client.rpc('hr_location_transfer_options_v1',{p_actor:actor,p_tenant:tenant,p_employee:employee,p_after:after}).abortSignal(AbortSignal.timeout(12000));if(error)throw error;return parseHrTransferOptions(data,actor,tenant,employee);
}
export async function saveHrTransfer(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareHrLocationTransfer>,employee:string){
 const {data,error}=await client.rpc('hr_scoped_location_transfer_v1',intent).abortSignal(AbortSignal.timeout(15000));if(error)throw error;return parseHrLocationTransferReceipt(data,intent,employee);
}
