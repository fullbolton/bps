import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
// Execute the actual TS module; do not copy the implementation into the test.
const source=readFileSync(new URL('../src/lib/operations/daily-demand.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020},reportDiagnostics:true});
assert.equal(output.diagnostics?.length,0);
const {isWorkDate,validateDailyDemand,deriveDailyCoverage,checkAssignment}=await import('data:text/javascript;base64,'+Buffer.from(output.outputText).toString('base64'));
const input={companyId:'company',locationId:'location',serviceLine:'temizlik',position:'temizlik görevlisi',workDate:'2026-09-08',requiredCount:2};
const check={companyActive:true,locationActive:true,workerActive:true,workerBookedOnDay:false,lifecycle:'active',requiredCount:2,assignedCount:0};
test('real dates, leap years and strict format',()=>{
  for(const v of ['2026-09-08','2024-02-29']) assert.equal(isWorkDate(v),true);
  for(const v of ['2026-02-30','2025-02-29','2026-9-8','0000-01-01','2026-09-08T00:00:00Z',null]) assert.equal(isWorkDate(v),false);
});
test('required fields, counts and extra untrusted fields',()=>{
  assert.equal(validateDailyDemand(null).ok,false);
  for(const requiredCount of [0,-1,1.5,Infinity,NaN,'2',Number.MAX_SAFE_INTEGER+1]) assert.equal(validateDailyDemand({...input,requiredCount}).ok,false);
  const good=validateDailyDemand({...input,position:' garson ',tenant_id:'untrusted'});
  assert.equal(good.value.position,'garson'); assert.equal('tenant_id' in good.value,false);
  assert.equal(validateDailyDemand({...input,locationId:' '}).ok,false);
});
test('daily coverage from zero to full',()=>{
  assert.deepEqual([0,1,2].map(n=>deriveDailyCoverage(2,n,'active').open),[2,1,0]);
  assert.deepEqual([0,1,2].map(n=>deriveDailyCoverage(2,n,'active').state),['unassigned','partial','assigned']);
});
test('paused and cancelled are not active demand',()=>{
  assert.equal(deriveDailyCoverage(2,1,'paused').activeOpen,0);
  assert.equal(deriveDailyCoverage(2,1,'paused').open,1);
  assert.equal(deriveDailyCoverage(2,0,'cancelled').activeOpen,0);
  assert.throws(()=>deriveDailyCoverage(2,1,'cancelled'));
});
test('corrupt aggregates fail rather than clamp',()=>{
  for(const n of [-1,3,NaN,1.2]) assert.throws(()=>deriveDailyCoverage(2,n,'active'));
});
test('assignment eligibility failures stay distinct',()=>{
  assert.deepEqual(checkAssignment(check),{ok:true});
  for(const [patch,code] of [[{companyActive:false},'INACTIVE_COMPANY'],[{locationActive:false},'INACTIVE_LOCATION'],[{workerActive:false},'INACTIVE_WORKER'],[{workerBookedOnDay:true},'WORKER_CONFLICT'],[{assignedCount:2},'CAPACITY_FULL'],[{lifecycle:'paused'},'REQUEST_NOT_ACTIVE']]) {
    assert.deepEqual(checkAssignment({...check,...patch}),{ok:false,code});
  }
});
test('missing or nonboolean verification never means available',()=>{
  for(const patch of [{workerBookedOnDay:null},{workerActive:'true'},{companyActive:undefined},{assignedCount:3},{lifecycle:'invalid'}]) {
    assert.deepEqual(checkAssignment({...check,...patch}),{ok:false,code:'UNVERIFIABLE'});
  }
});
