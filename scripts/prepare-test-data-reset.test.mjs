import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReset, validateBackup, PROJECT } from './prepare-test-data-reset.mjs';

function fixture() {
  let id=1;
  return {project_ref:PROJECT,tables:Object.fromEntries(Object.entries({companies:5,
    contracts:2,tasks:4,appointments:2,notes:1,staffing_demands:1,critical_dates:1})
    .map(([t,n])=>[t,Array.from({length:n},()=>({id:`00000000-0000-0000-0000-${String(id++).padStart(12,'0')}`,name:'test'}))]))};
}
test('default produces rehearsal, never commit',()=>assert.match(generateReset(fixture()),/ROLLBACK;\n$/));
test('explicit commit is separate artifact',()=>assert.match(generateReset(fixture(),{commit:true}),/COMMIT;\n$/));
test('wrong project, unexpected table, missing row and duplicate id rejected',()=>{
  const wrong=fixture(); wrong.project_ref='other'; assert.throws(()=>validateBackup(wrong));
  const extra=fixture(); extra.tables.profiles=[]; assert.throws(()=>validateBackup(extra));
  const missing=fixture(); missing.tables.tasks.pop(); assert.throws(()=>validateBackup(missing));
  const duplicate=fixture(); duplicate.tables.tasks[1].id=duplicate.tables.tasks[0].id; assert.throws(()=>validateBackup(duplicate));
});
test('untrusted text stays inside SQL literal',()=>{
  const b=fixture(); b.tables.notes[0].name="O'Brien; DROP TABLE profiles; --";
  assert.ok(generateReset(b).includes("O''Brien; DROP TABLE profiles; --"));
});
test('data cannot terminate the outer DO block',()=>{
  const b=fixture(); b.tables.notes[0].name="$bps_reset$; COMMIT; $bps_reset_1$";
  const sql=generateReset(b);
  assert.ok(sql.includes('DO $bps_reset_2$'));
  assert.equal(sql.split('$bps_reset_2$').length,3);
  assert.match(sql,/ROLLBACK;\n$/);
});
