import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';import {id} from './fixtures/daily-operations.mjs';
const m=await importActualTypeScript(new URL('../src/lib/talent/contact-summary.ts',import.meta.url));
const scope={actorId:id(1),tenantId:id(2)},ids=[id(3),id(4)],last={id:id(5),sourcePersonId:id(3),recordedAt:'2026-09-27T10:00:00Z',channel:'phone',outcome:'call_back'};
const response={...scope,generatedAt:'2026-09-27T10:00:00Z',rows:[{personId:ids[0],last},{personId:ids[1],last:null}]};
test('explicit empty differs from missing, and every requested identity is accounted for',()=>{
 assert.equal(m.parseContactSummaries(response,scope,ids)[ids[1]],null);
 for(const rows of [[],response.rows.slice(0,1),[response.rows[0],response.rows[0]],[{personId:ids[0]},{personId:ids[1],last:null}],[{personId:id(8),last},response.rows[1]]])assert.throws(()=>m.parseContactSummaries({...response,rows},scope,ids));
});
test('reject wrong tenant, actor, timestamps and job-specific decline in general summary',()=>{
 for(const patch of [{tenantId:id(8)},{actorId:id(8)},{generatedAt:'bad'}])assert.throws(()=>m.parseContactSummaries({...response,...patch},scope,ids));
 for(const patch of [{recordedAt:'bad'},{channel:'__proto__'},{outcome:'declined'},{sourcePersonId:null}])assert.throws(()=>m.parseContactSummaries({...response,rows:[{personId:ids[0],last:{...last,...patch}},response.rows[1]]},scope,ids));
});
test('bound requests to one server page and accept empty page',()=>{
 for(const ids of [null,[id(3),id(3)],[null],Array.from({length:51},(_,i)=>id(i+1))])assert.throws(()=>m.validateSummaryIds(ids));
 assert.deepEqual(m.parseContactSummaries({...response,rows:[]},scope,[]),{});
});
