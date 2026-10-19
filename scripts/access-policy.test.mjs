import test from 'node:test';
import assert from 'node:assert/strict';
import { importActualTypeScript } from './helpers/import-typescript.mjs';
const { evaluateAccess: evaluate, parseAccessPolicy: parse, ACCESS_CAPABILITIES: capabilities } = await importActualTypeScript(new URL('../src/lib/access/policy.ts', import.meta.url));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rule = (capability, scope = {kind:'company'}, effect = 'allow') => ({capability,scope,effect});
const policy = () => ({version:1,tenantId:id(1),actorId:id(2),revision:1,roleId:id(3),rules:[rule('hr.employees.read')],exceptions:[]});
const record = () => ({tenantId:id(1),accountId:id(2),departmentId:id(4),locationId:id(5)});
const context = () => ({actorId:id(2),tenantId:id(1),policyRevision:1,now:'2026-10-19T12:00:00.000Z',modules:{hr:true,finance:true},entitlements:{hr:true,finance:true}});
const check = (p=policy(),r=record(),c=context(),key='hr.employees.read') => evaluate(p,key,r,c);
test('unknown contracts, permissions, empty scopes and malformed expiry fail closed', () => {
  for (const mutate of [p=>p.version=2,p=>p.rules[0].capability='hr.*',p=>p.extra=true,p=>p.rules[0].scope={kind:'selected',departmentIds:[],locationIds:[]},p=>p.revision=0,p=>p.rules[0].effect='admin',p=>p.rules[0].scope={kind:'company',locationIds:[]},p=>p.exceptions=[{...rule('hr.employees.read'),startsAt:'2026-02-30T12:00:00.000Z',expiresAt:'2026-12-01T12:00:00.000Z',reason:'test'}]]) {
    const p=policy();mutate(p);assert.throws(()=>parse(p));assert.equal(check(p).reason,'invalid');
  }
  for (const key of ['toString','constructor','hr.unknown']) assert.equal(check(policy(),record(),context(),key).reason,'invalid');
  const original=policy(),copy=parse(original);original.rules.length=0;assert.equal(copy.rules.length,1);
});
test('company, actor, policy revision and closed modules remain boundaries even with full grants', () => {
  assert.equal(check().allowed,true);
  assert.equal(check(policy(),{...record(),tenantId:id(9)}).reason,'scope_mismatch');
  assert.equal(check(policy(),record(),{...context(),actorId:id(9)}).reason,'scope_mismatch');
  assert.equal(check(policy(),record(),{...context(),policyRevision:2}).reason,'stale_policy');
  for(const field of ['modules','entitlements']) assert.equal(check(policy(),record(),{...context(),[field]:{hr:false,finance:true}}).reason,'module_closed');
});
test('selected department and own office scopes intersect and missing attributes never match', () => {
  const p=policy();p.rules=[rule('hr.employees.read',{kind:'selected',departmentIds:[id(4)],locationIds:[id(5)]})];
  assert.equal(check(p).allowed,true);
  for(const changed of [{departmentId:id(8)},{locationId:id(8)},{departmentId:null},{locationId:null}]) assert.equal(check(p,{...record(),...changed}).allowed,false);
  p.rules[0].scope={kind:'selected',departmentIds:[],locationIds:[id(5)]};assert.equal(check(p,{...record(),departmentId:null}).allowed,true);
  p.rules[0].scope={kind:'self'};assert.equal(check(p).allowed,true);assert.equal(check(p,{...record(),accountId:null}).allowed,false);
});
test('deny dominates any role or temporary grant without affecting unrelated scopes', () => {
  const p=policy();p.rules.push(rule('hr.employees.read',{kind:'selected',departmentIds:[id(4)],locationIds:[]},'deny'));
  p.exceptions=[{...rule('hr.employees.read'),startsAt:'2026-10-19T00:00:00.000Z',expiresAt:'2026-10-20T00:00:00.000Z',reason:'Temporary work'}];
  assert.equal(check(p).reason,'explicit_deny');assert.equal(check(p,{...record(),departmentId:id(7)}).allowed,true);
  p.rules.reverse();assert.equal(check(p).reason,'explicit_deny');
});
test('temporary exceptions begin inclusively and expire exclusively; expired denies disappear', () => {
  const p=policy();p.rules=[];p.exceptions=[{...rule('hr.employees.read'),startsAt:'2026-10-19T12:00:00.000Z',expiresAt:'2026-10-19T13:00:00.000Z',reason:'Coverage'}];
  assert.equal(check(p).allowed,true);
  for(const now of ['2026-10-19T11:59:59.999Z','2026-10-19T13:00:00.000Z']) assert.equal(check(p,record(),{...context(),now}).allowed,false);
  p.rules=[rule('hr.employees.read')];p.exceptions[0].effect='deny';assert.equal(check(p).reason,'explicit_deny');
  assert.equal(check(p,record(),{...context(),now:'2026-10-19T13:00:00.000Z'}).allowed,true);
});
test('export, salary and attachment permissions never follow from list read and require same-record read', () => {
  for(const capability of ['hr.employees.export','hr.compensation.read','hr.documents.download']) {
    const p=policy();assert.equal(check(p,record(),context(),capability).allowed,false);
    p.rules.push(rule(capability));assert.equal(check(p,record(),context(),capability).allowed,true);
    p.rules[0].scope={kind:'self'};assert.equal(check(p,{...record(),accountId:id(7)},context(),capability).reason,'prerequisite_denied');
    p.rules.push(rule('hr.employees.read',{kind:'company'},'deny'));assert.equal(check(p,record(),context(),capability).allowed,false);
  }
});
test('accounting reader cannot update/export; manager grants do not grant HR access', () => {
  const p=policy();p.rules=[rule('finance.summary.read')];
  assert.equal(check(p,record(),context(),'finance.summary.read').allowed,true);
  assert.equal(check(p,record(),context(),'finance.summary.update').allowed,false);
  p.rules.push(rule('finance.summary.update'),rule('finance.summary.export'));
  assert.equal(check(p,record(),context(),'finance.summary.export').allowed,true);assert.equal(check(p).allowed,false);
});
test('capability dependencies exist and contain no cycles', () => {
  function walk(key,path=[]) {assert.ok(!path.includes(key));assert.ok(Object.hasOwn(capabilities,key));for(const dep of capabilities[key].requires)walk(dep,[...path,key]);}
  Object.keys(capabilities).forEach(key=>walk(key));
});
