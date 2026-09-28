import test from 'node:test';import assert from 'node:assert/strict';import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseWorkspaceSetup}=await importActualTypeScript(new URL('../src/lib/workspace-setup.ts',import.meta.url));
const row={tenantId:'tenant',name:'Çalışma alanı',today:'2026-09-09',companies:0,locations:0,members:1,workers:0,requests:0,assignments:0};
test('setup accepts measured zeros but rejects unavailable/wrong-scope response',()=>{
 assert.deepEqual(parseWorkspaceSetup(row,'tenant'),row);for(const v of [null,[],{}, {...row,tenantId:'other'},{...row,name:''}])assert.throws(()=>parseWorkspaceSetup(v,'tenant'));
});
test('setup rejects coerced, missing, negative or unsafe counts and invalid calendar dates',()=>{
 for(const v of [{...row,members:'1'},{...row,companies:-1},{...row,requests:undefined},{...row,workers:Number.MAX_SAFE_INTEGER+1},{...row,today:'2026-02-30'}])assert.throws(()=>parseWorkspaceSetup(v,'tenant'));
});
