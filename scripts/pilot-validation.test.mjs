import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleUrl(file, replacements = {}) {
  let source = readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to);
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics.length, 0);
  return 'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64');
}
const domain = moduleUrl('../src/lib/operations/daily-demand.ts');
const { validatePilotPayload, parsePilotBoard } = await import(moduleUrl('../src/lib/operations/pilot-validation.ts', { '"./daily-demand"': JSON.stringify(domain) }));
const id = '00000000-0000-4000-8000-000000000001';
const request = { companyId: id, locationId: id, workDate: '2026-09-09', serviceLine: ' Temizlik ', position: 'Görevli', requiredCount: 2 };
test('command payload allowlists fields and trims text', () => {
  const result = validatePilotPayload('request', { ...request, tenant_id: id, lifecycle: 'cancelled' });
  assert.equal(result.serviceLine, 'Temizlik');
  assert.equal('tenant_id' in result, false);
  assert.equal('lifecycle' in result, false);
});
test('unknown commands including prototype properties are rejected', () => {
  for (const kind of ['toString', '__proto__', 'delete', '', null]) assert.throws(() => validatePilotPayload(kind, {}));
});
test('request boundary, date and identity validation', () => {
  for (const patch of [{ requiredCount: 101 }, { requiredCount: '2' }, { requiredCount: 1.5 }, { workDate: '2026-02-30' }, { workDate: '1999-12-31' }, { workDate: '2101-01-01' }, { locationId: 'legacy-id' }]) {
    assert.throws(() => validatePilotPayload('request', { ...request, ...patch }));
  }
  assert.equal(validatePilotPayload('request', { ...request, requiredCount: 100 }).requiredCount, 100);
});
test('directory and assignment commands require their own fields', () => {
  assert.deepEqual(validatePilotPayload('assign', { requestId: id, workerId: id }), { requestId: id, workerId: id });
  assert.throws(() => validatePilotPayload('remove', { requestId: id }));
  assert.throws(() => validatePilotPayload('worker', { name: 'A', code: '1', kind: 'admin' }));
  assert.throws(() => validatePilotPayload('location', { companyId: id, name: ' ', city: 'İstanbul' }));
});
test('null and nonboolean board data cannot become an empty or available board', () => {
  for (const value of [null, 'true', {}, { locations: [], workers: [], requests: null }]) assert.throws(() => parsePilotBoard(value));
  for (const booked of [null, 'false', undefined]) assert.throws(() => parsePilotBoard({ locations: [], requests: [], workers: [{ id, name: 'A', code: '1', active: true, booked }] }));
  assert.deepEqual(parsePilotBoard({ locations: [], workers: [], requests: [] }), { locations: [], workers: [], requests: [] });
});
test('capacity and cancellation contradictions fail board validation', () => {
  const row = { ...request, id, lifecycle: 'active', assignments: [], attendance: [] };
  const board = (r) => ({ locations: [], workers: [], requests: [r] });
  assert.equal(parsePilotBoard(board(row)).requests.length, 1);
  assert.throws(() => parsePilotBoard(board({ ...row, requiredCount: 1, assignments: [{ id, workerId: id }, { id, workerId: id }] })));
  assert.throws(() => parsePilotBoard(board({ ...row, lifecycle: 'cancelled', assignments: [{ id, workerId: id }] })));
});
test('capacity edit requires valid old and new counts and strips unrelated fields',()=>{
  assert.deepEqual(validatePilotPayload('resize',{requestId:id,expectedCount:2,requiredCount:3,tenantId:id}),{requestId:id,expectedCount:2,requiredCount:3});
  for(const patch of [{expectedCount:0},{expectedCount:'2'},{requiredCount:101},{requiredCount:1.5},{requestId:'x'}])assert.throws(()=>validatePilotPayload('resize',{requestId:id,expectedCount:2,requiredCount:3,...patch}));
});

test('attendance requires exact status and nonnegative bounded revision',()=>{
  for(const patch of [{status:null},{status:['present']},{expectedRevision:-1},{expectedRevision:'0'},{expectedRevision:2147483647}])assert.throws(()=>validatePilotPayload('attendance',{assignmentId:id,expectedRevision:0,status:'present',...patch}));
  assert.deepEqual(validatePilotPayload('attendance',{assignmentId:id,expectedRevision:0,status:'absent',tenantId:id}),{assignmentId:id,expectedRevision:0,status:'absent'});
});
test('board cannot drop attendance or turn unknown into absence',()=>{
  const a={id,workerId:id,status:'unreported',revision:0,removed:false};
  const r={...request,id,lifecycle:'active',assignments:[{id,workerId:id}],attendance:[a]};
  const b=r=>({locations:[],workers:[],requests:[r]});
  assert.equal(parsePilotBoard(b(r)).requests[0].attendance[0].status,'unreported');
  for(const attendance of [undefined,[],[{...a,status:['present']}],[{...a,removed:true}],[a,a]])assert.throws(()=>parsePilotBoard(b({...r,attendance})));
  assert.equal(parsePilotBoard(b({...r,lifecycle:'cancelled',assignments:[],attendance:[{...a,status:'present',revision:1,removed:true}]})).requests[0].attendance.length,1);
});
