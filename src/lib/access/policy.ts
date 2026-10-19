/** Proposed access contract. Not wired to production authorization yet.
 * Inputs must come from verified server state, never request-provided record attributes.
 * Existing SQL guards remain authoritative until each endpoint is migrated.
 */
export const ACCESS_CAPABILITIES = {
  'hr.employees.read': { module: 'hr', requires: [] },
  'hr.employees.create': { module: 'hr', requires: ['hr.employees.read'] },
  'hr.employees.update': { module: 'hr', requires: ['hr.employees.read'] },
  'hr.employees.export': { module: 'hr', requires: ['hr.employees.read'] },
  'hr.compensation.read': { module: 'hr', requires: ['hr.employees.read'] },
  'hr.documents.download': { module: 'hr', requires: ['hr.employees.read'] },
  'finance.summary.read': { module: 'finance', requires: [] },
  'finance.summary.update': { module: 'finance', requires: ['finance.summary.read'] },
  'finance.summary.export': { module: 'finance', requires: ['finance.summary.read'] },
} as const;
export type Capability = keyof typeof ACCESS_CAPABILITIES;
type Scope = { kind: 'company' } | { kind: 'self' } | {
  kind: 'selected'; departmentIds: string[]; locationIds: string[];
};
type Rule = { capability: Capability; effect: 'allow' | 'deny'; scope: Scope };
type Exception = Rule & { startsAt: string; expiresAt: string; reason: string };
export type AccessPolicy = {
  version: 1; tenantId: string; actorId: string; revision: number;
  roleId: string; rules: Rule[]; exceptions: Exception[];
};
export type AccessRecord = {
  tenantId: string;
  /** Account linked to this employee; null is not self. */
  accountId: string | null;
  departmentId: string | null;
  /** Company's own office/location, never a customer's branch. */
  locationId: string | null;
};
export type AccessContext = {
  actorId: string; tenantId: string; policyRevision: number; now: string;
  modules: { hr: boolean; finance: boolean };
  entitlements: { hr: boolean; finance: boolean };
};
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const exact = (x: Record<string, unknown>, keys: string[]) => Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const instant = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
const ids = (x: unknown): x is string[] => Array.isArray(x) && x.length <= 1000 && x.every(uuid) && new Set(x).size === x.length;
function validScope(x: unknown): boolean {
  if (!object(x)) return false;
  if (x.kind === 'company' || x.kind === 'self') return exact(x, ['kind']);
  return x.kind === 'selected' && exact(x, ['kind', 'departmentIds', 'locationIds'])
    && ids(x.departmentIds) && ids(x.locationIds) && x.departmentIds.length + x.locationIds.length > 0;
}
function validRule(x: unknown, exception: boolean): boolean {
  if (!object(x) || !exact(x, ['capability', 'effect', 'scope', ...(exception ? ['startsAt', 'expiresAt', 'reason'] : [])])) return false;
  if (typeof x.capability !== 'string' || !Object.hasOwn(ACCESS_CAPABILITIES, x.capability)
    || typeof x.effect !== 'string' || !['allow', 'deny'].includes(x.effect) || !validScope(x.scope)) return false;
  return !exception || (instant(x.startsAt) && instant(x.expiresAt) && x.startsAt < x.expiresAt
    && typeof x.reason === 'string' && x.reason.trim().length > 0 && x.reason.length <= 500);
}
/** Strict wire contract: unsupported permission/scope cannot silently broaden access. */
export function parseAccessPolicy(raw: unknown): AccessPolicy {
  if (!object(raw) || !exact(raw, ['version', 'tenantId', 'actorId', 'revision', 'roleId', 'rules', 'exceptions'])
    || raw.version !== 1 || !uuid(raw.tenantId) || !uuid(raw.actorId) || !uuid(raw.roleId)
    || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 1
    || !Array.isArray(raw.rules) || raw.rules.length > 200 || !raw.rules.every(x => validRule(x, false))
    || !Array.isArray(raw.exceptions) || raw.exceptions.length > 100 || !raw.exceptions.every(x => validRule(x, true))) {
    throw Error('ACCESS_POLICY_INVALID');
  }
  // Isolate from caller mutation while retaining a serializable contract.
  return structuredClone(raw) as AccessPolicy;
}
export type AccessDecision = { allowed: true; reason: 'allowed' } | {
  allowed: false; reason: 'invalid' | 'scope_mismatch' | 'stale_policy' | 'module_closed' | 'explicit_deny' | 'not_granted' | 'prerequisite_denied';
};
function matches(scope: Scope, record: AccessRecord, actorId: string): boolean {
  if (scope.kind === 'company') return true;
  if (scope.kind === 'self') return record.accountId === actorId;
  // Within each dimension OR; across populated dimensions AND. Missing attributes never match.
  return (!scope.departmentIds.length || (record.departmentId !== null && scope.departmentIds.includes(record.departmentId)))
    && (!scope.locationIds.length || (record.locationId !== null && scope.locationIds.includes(record.locationId)));
}
export function evaluateAccess(raw: unknown, capability: string, record: AccessRecord, context: AccessContext): AccessDecision {
  let policy: AccessPolicy;
  try { policy = parseAccessPolicy(raw); } catch { return { allowed: false, reason: 'invalid' }; }
  if (!Object.hasOwn(ACCESS_CAPABILITIES, capability) || !context || !record
    || !uuid(context.actorId) || !uuid(context.tenantId) || !uuid(record.tenantId) || !instant(context.now)
    || ![record.accountId, record.departmentId, record.locationId].every(x => x === null || uuid(x))) return { allowed: false, reason: 'invalid' };
  if (policy.actorId !== context.actorId || policy.tenantId !== context.tenantId || record.tenantId !== context.tenantId) return { allowed: false, reason: 'scope_mismatch' };
  if (policy.revision !== context.policyRevision) return { allowed: false, reason: 'stale_policy' };
  const rules: Rule[] = [...policy.rules, ...policy.exceptions.filter(x => x.startsAt <= context.now && context.now < x.expiresAt)];
  function check(key: Capability): AccessDecision {
    const definition = ACCESS_CAPABILITIES[key];
    if (context.modules?.[definition.module] !== true || context.entitlements?.[definition.module] !== true) return { allowed: false, reason: 'module_closed' };
    const applicable = rules.filter(x => x.capability === key && matches(x.scope, record, context.actorId));
    if (applicable.some(x => x.effect === 'deny')) return { allowed: false, reason: 'explicit_deny' };
    if (!applicable.some(x => x.effect === 'allow')) return { allowed: false, reason: 'not_granted' };
    for (const prerequisite of definition.requires) if (!check(prerequisite).allowed) return { allowed: false, reason: 'prerequisite_denied' };
    return { allowed: true, reason: 'allowed' };
  }
  return check(capability as Capability);
}
