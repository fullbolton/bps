import {readFileSync} from 'node:fs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFixtureMigrations,validateFixtureMigrations} from '../qa/module-change-command-20261017/fixture-migrations.mjs';
const first='20261013000100_calendar.sql',second='20261017000100_staffing.sql';
test('shared module fixture includes every post-baseline repository migration in order',()=>{
 assert.ok(loadFixtureMigrations().length>0);
});
test('a newly added migration makes stale acceptance fail closed',()=>{
 assert.throws(()=>validateFixtureMigrations([first],[first,second]),/differ from repository/);
});
test('missing files, duplicates, reordered entries, malformed names and empty lists are rejected',()=>{
 for(const manifest of [[first,second],[first,first],[second,first],['../other.sql'],[],null]){
  const available=manifest?.length===2&&manifest[0]===second?[first,second]:[first];
  assert.throws(()=>validateFixtureMigrations(manifest,available));
 }
});
test('historical files and non-SQL notes do not become fixture migrations',()=>{
 assert.deepEqual(validateFixtureMigrations([first],[first,'20261005003100_baseline.sql','README.md']),[first]);
});

test('atomic command expects exactly the checks required by the preview parser',async()=>{
 const {MODULE_CHANGE_CHECKS}=await importActualTypeScript(new URL('../src/lib/modules/change-preview.ts',import.meta.url));
 const sql=readFileSync(new URL('../qa/module-change-command-20261017/command-candidate.sql',import.meta.url),'utf8');
 const checks=[...sql.matchAll(/\('([a-z_]+)','([a-z_]+)'\)/g)].map(m=>({module:m[1],code:m[2]}));
 assert.deepEqual(checks,MODULE_CHANGE_CHECKS.map(({module,code})=>({module,code})));
});
