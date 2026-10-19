/** Backend command adapter only; no production HR menu/activation is enabled here. */
export type WorkplacePayload =
  | { kind: 'create_location'; name: string }
  | { kind: 'assign_location'; employeeId: string; employmentId: string; locationId: string; startsOn: string; endsOn?: string }
  | { kind: 'link_account'; employeeId: string; accountId: string }
  | { kind: 'unlink_account'; id: string; expectedRevision: number }
  | { kind: 'end_location' | 'close_location'; id: string; expectedRevision: number; endsOn: string };
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const date = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= '1900-01-01' && x <= '2199-12-31' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0,10) === x;
const revision = (x: unknown): x is number => Number.isSafeInteger(x) && Number(x) > 0;
export function prepareWorkplaceCommand(actorId: string, tenantId: string, commandId: string, payload: WorkplacePayload) {
  if (![actorId,tenantId,commandId].every(uuid) || !payload || typeof payload !== 'object') throw Error('HR_INPUT');
  let keys: string[];
  switch(payload.kind) {
    case 'create_location':
      keys=['kind','name'];
      if(typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length>120) throw Error('HR_INPUT');
      break;
    case 'assign_location':
      keys=['kind','employeeId','employmentId','locationId','startsOn',...(Object.hasOwn(payload,'endsOn')?['endsOn']:[])];
      if(![payload.employeeId,payload.employmentId,payload.locationId].every(uuid) || !date(payload.startsOn)
        || (Object.hasOwn(payload,'endsOn') && (!date(payload.endsOn)||payload.endsOn<payload.startsOn))) throw Error('HR_INPUT');
      break;
    case 'link_account':
      keys=['kind','employeeId','accountId'];
      if(!uuid(payload.employeeId)||!uuid(payload.accountId)) throw Error('HR_INPUT');
      break;
    case 'unlink_account':
    case 'end_location':
    case 'close_location':
      keys=['kind','id','expectedRevision',...(payload.kind==='unlink_account'?[]:['endsOn'])];
      if(!uuid(payload.id)||!revision(payload.expectedRevision)||payload.expectedRevision>=Number.MAX_SAFE_INTEGER
        || (payload.kind!=='unlink_account'&&!date(payload.endsOn))) throw Error('HR_INPUT');
      break;
    default: throw Error('HR_INPUT');
  }
  if(Object.keys(payload).length!==keys.length || !keys.every(key=>Object.hasOwn(payload,key))) throw Error('HR_INPUT');
  return Object.freeze({p_actor:actorId,p_tenant:tenantId,p_command:commandId,p_payload:Object.freeze({...payload})});
}
type Intent = ReturnType<typeof prepareWorkplaceCommand>;
type Client = {rpc(name: 'hr_workplace_command_v1', args: Intent): {abortSignal(signal: AbortSignal): PromiseLike<{data: unknown; error: unknown}>}};
export async function saveWorkplaceCommand(client: Client, intent: Intent) {
  const {data,error}=await client.rpc('hr_workplace_command_v1',intent).abortSignal(AbortSignal.timeout(15000));
  if(error) throw error;
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Error('HR_RECEIPT_INVALID');
  const receipt=data as Record<string,unknown>;
  const existing='id' in intent.p_payload;
  const expectedRevision='expectedRevision' in intent.p_payload?intent.p_payload.expectedRevision+1:1;
  if(Object.keys(receipt).length!==7 || receipt.schemaVersion!==1 || receipt.actorId!==intent.p_actor || receipt.tenantId!==intent.p_tenant
    || receipt.commandId!==intent.p_command || receipt.kind!==intent.p_payload.kind || !uuid(receipt.id)
    || !revision(receipt.revision) || receipt.revision!==expectedRevision || (existing && receipt.id!==intent.p_payload.id)) throw Error('HR_RECEIPT_INVALID');
  return {id:receipt.id,revision:receipt.revision};
}
