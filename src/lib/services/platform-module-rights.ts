import type {SupabaseClient} from '@supabase/supabase-js';
import type {Database} from '@/types/database.types';
import {isUuid} from '@/lib/operations/pilot-validation';
import {isRevision} from '@/lib/modules/context';
import {parseRights} from '@/lib/modules/entitlements';
import {parseCatalogSnapshot} from '@/lib/modules/catalog-snapshot';
export function parsePlatformRights(raw:unknown,actor:string,tenant:string){
 if(!isUuid(actor)||!isUuid(tenant)||!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('RIGHTS_RESPONSE');
 const row=raw as Record<string,unknown>;
 if(row.schemaVersion!==1||row.actorId!==actor||row.tenantId!==tenant||typeof row.name!=='string'||!row.name.trim()||!isRevision(row.revision))throw Error('RIGHTS_SCOPE');
 const granted=parseRights(row.granted),ready=parseRights(row.ready),snapshot=parseCatalogSnapshot(2,row.enabled);
 if(snapshot.version!==2)throw Error('RIGHTS_RESPONSE');
 for(const key of Object.keys(granted) as (keyof typeof granted)[])if(snapshot.modules[key]&&(!granted[key]||!ready[key]))throw Error('RIGHTS_INCONSISTENT');
 return Object.freeze({actor,tenant,name:row.name,revision:row.revision,granted,ready,enabled:snapshot.modules});
}
export async function loadPlatformRights(client:SupabaseClient<Database>,actor:string,tenant:string){
 const {data,error}=await client.rpc('platform_module_rights_v1',{p_actor:actor,p_tenant:tenant}).abortSignal(AbortSignal.timeout(12000));
 if(error)throw error;return parsePlatformRights(data,actor,tenant);
}
/** Preserve this immutable intent after an uncertain result; retries reuse its command id. */
export function prepareRightChange(snapshot:ReturnType<typeof parsePlatformRights>,module:keyof typeof snapshot.granted,command:string){
 if(!isUuid(command)||!Object.hasOwn(snapshot.granted,module)||snapshot.enabled[module])throw Error('RIGHTS_INPUT');
 return Object.freeze({p_actor:snapshot.actor,p_tenant:snapshot.tenant,p_revision:snapshot.revision,p_command:command,p_module:module,p_granted:!snapshot.granted[module]});
}
export async function saveRightChange(client:SupabaseClient<Database>,intent:ReturnType<typeof prepareRightChange>){
 const {data,error}=await client.rpc('set_module_entitlement_v1',intent).abortSignal(AbortSignal.timeout(15000));
 if(error)throw error;
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('RIGHTS_RECEIPT');
 const row=data as Record<string,unknown>;
 if(row.schemaVersion!==1||row.actorId!==intent.p_actor||row.tenantId!==intent.p_tenant||row.commandId!==intent.p_command||row.module!==intent.p_module||row.granted!==intent.p_granted||row.revision!==String(BigInt(intent.p_revision)+BigInt(1))||typeof row.replayed!=='boolean')throw Error('RIGHTS_RECEIPT');
 return row;
}
