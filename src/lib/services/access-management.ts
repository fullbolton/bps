import { parseAccessPolicy, type AccessPolicy } from '../access/policy';
type Rule = AccessPolicy['rules'][number];
type Exception = AccessPolicy['exceptions'][number];
export type AccessCommand =
  | { kind: 'save_role'; id?: string; name: string; rules: Rule[] }
  | { kind: 'archive_role' | 'revoke_exception'; id: string }
  | { kind: 'assign_role'; accountId: string; roleId: string }
  | { kind: 'unassign_role'; accountId: string }
  | { kind: 'add_exception'; accountId: string; rule: Exception };
const uuid = (x: unknown): x is string => typeof x==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
function freeze<T>(value: T): T {
  if(value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
export function prepareAccessCommand(actor: string,tenant: string,command: string,revision: number,payload: AccessCommand) {
  if(![actor,tenant,command].every(uuid)||!Number.isSafeInteger(revision)||revision<1||revision>=Number.MAX_SAFE_INTEGER||!payload||typeof payload!=='object')throw Error('ACCESS_INPUT');
  let keys: string[];let rules: Rule[]=[];let exceptions: Exception[]=[];
  switch(payload.kind) {
    case 'save_role':
      keys=['kind','name','rules',...(Object.hasOwn(payload,'id')?['id']:[])];
      if(typeof payload.name!=='string'||!payload.name.trim()||payload.name.trim().length>100||(Object.hasOwn(payload,'id')&&!uuid(payload.id)))throw Error('ACCESS_INPUT');
      rules=payload.rules;break;
    case 'archive_role':case 'revoke_exception':
      keys=['kind','id'];if(!uuid(payload.id))throw Error('ACCESS_INPUT');break;
    case 'assign_role':
      keys=['kind','accountId','roleId'];if(!uuid(payload.roleId))throw Error('ACCESS_INPUT');break;
    case 'unassign_role':keys=['kind','accountId'];break;
    case 'add_exception':keys=['kind','accountId','rule'];exceptions=[payload.rule];break;
    default:throw Error('ACCESS_INPUT');
  }
  if(Object.keys(payload).length!==keys.length||!keys.every(key=>Object.hasOwn(payload,key)))throw Error('ACCESS_INPUT');
  if('accountId' in payload&&(!uuid(payload.accountId)||payload.accountId===actor))throw Error('ACCESS_PROTECTED_ACCOUNT');
  // Reuse the versioned permission contract; SQL additionally verifies company-owned scope IDs.
  parseAccessPolicy({version:1,tenantId:tenant,actorId:actor,roleId:command,revision,rules,exceptions});
  return freeze({p_actor:actor,p_tenant:tenant,p_command:command,p_revision:revision,p_payload:structuredClone(payload)});
}
type Intent=ReturnType<typeof prepareAccessCommand>;
type Client={rpc(name:'company_access_command_v1',args:Intent):{abortSignal(signal:AbortSignal):PromiseLike<{data:unknown;error:unknown}>}};
export async function saveAccessCommand(client:Client,intent:Intent) {
  const {data,error}=await client.rpc('company_access_command_v1',intent).abortSignal(AbortSignal.timeout(15000));
  if(error)throw error;
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('ACCESS_RECEIPT_INVALID');
  const r=data as Record<string,unknown>,p=intent.p_payload;
  const expectedId='id' in p?p.id:p.kind==='assign_role'?p.roleId:p.kind==='unassign_role'?p.accountId:null;
  if(Object.keys(r).length!==7||r.schemaVersion!==1||r.actorId!==intent.p_actor||r.tenantId!==intent.p_tenant||r.commandId!==intent.p_command
    ||r.kind!==p.kind||!uuid(r.id)||r.revision!==intent.p_revision+1||(expectedId&&r.id!==expectedId))throw Error('ACCESS_RECEIPT_INVALID');
  return {id:r.id,revision:r.revision as number};
}
