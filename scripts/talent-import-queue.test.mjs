import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';import {id} from './fixtures/daily-operations.mjs';
const {splitImportPlan}=await importActualTypeScript(new URL('../src/lib/talent/import-request.ts',import.meta.url));
const {parseImportQueue}=await importActualTypeScript(new URL('../src/lib/talent/import-queue.ts',import.meta.url));
test('a large source is partitioned without losing or renumbering any source row',async()=>{
 const rows=Array.from({length:1201},(_,i)=>({number:i+2,kind:'hold'}));const parts=await splitImportPlan(rows);
 assert.deepEqual(parts.map(p=>p.total),[500,500,201]);assert.deepEqual(parts.flatMap(p=>p.rows),rows);assert.equal(new Set(parts.map(p=>p.batchId)).size,3);
 assert.equal(parseImportQueue(parts).length,3);assert.ok(parseImportQueue(parts).every(r=>!('rows' in r)));
});
test('duplicate targets across partition boundary are rejected before any part can be sent',async()=>{
 const row={number:2,kind:'existing',targetId:id(1),expectedRevision:1,fields:['name'],source:{name:'Sentetik',city:'',phone:'',email:''}};
 const rows=[row,...Array.from({length:499},(_,i)=>({number:i+3,kind:'hold'})),{...row,number:502}];
 await assert.rejects(splitImportPlan(rows));await assert.rejects(splitImportPlan([{number:2,kind:'hold'},{number:2,kind:'hold'}]));
});
test('queue references reject corruption and duplicates instead of skipping parts',()=>{
 const ref={batchId:id(1),sourceHash:'a'.repeat(64),total:500};assert.deepEqual(parseImportQueue([ref]),[ref]);
 for(const value of [null,{},[ref,ref],[{...ref,total:501}],[{...ref,sourceHash:'bad'}]])assert.throws(()=>parseImportQueue(value));
});
