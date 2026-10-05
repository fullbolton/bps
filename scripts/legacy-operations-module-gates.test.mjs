import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entries,render,migrationUrl,tables} from './legacy-operations-module-gates.mjs';
import {entries as scoped} from './operations-module-gates.mjs';
test('legacy migration is deterministic and covers seven entries and four tables',()=>{
 assert.equal(entries.length,7);assert.equal(tables.length,4);assert.equal(readFileSync(migrationUrl,'utf8'),render());
});
test('historical workspace and shift patches change seven public scoped and four legacy bodies',()=>{
 // The private replacement helper is deliberately absent from browser RPC gates.
 assert.deepEqual(scoped.filter(e=>e.appliedHistoryCount).map(e=>e.name),[
  'ops_record_attendance','ops_start_execute','ops_start_board','ops_start_board_filtered',
  'ops_comment_send','ops_comment_people','ops_fixed_roster_idp_create',
 ]);
 assert.ok(!scoped.some(e=>e.name==='ops_replace_assignment_before_start'));assert.equal(entries.filter(e=>e.appliedHistoryCount).length,4);
 const start=scoped.find(e=>e.name==='ops_start_execute');assert.ok(start.body.includes('START_SHIFT_TIME'));assert.ok(!start.body.includes("pr.role IN ('yonetici','operasyon')"));
 assert.ok(entries.find(e=>e.name==='ops_mutate').body.includes('occupied_range && v_request.shift_range'));
});
test('reconstructed declarations contain exact bodies including SQL regex dollar literals',()=>{
 for(const e of [...entries,...scoped])assert.ok(e.declaration.includes(e.body),e.name);
 for(const e of entries.filter(e=>!e.definer))assert.ok(e.guard.includes('workspace_module_enabled_v1')); // no invoker privilege escalation
});
