import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const m=await importActualTypeScript(new URL('../src/lib/talent/conversations.ts',import.meta.url));
const input={commandId:id(1),personId:id(2),requestId:null,channel:'phone',outcome:'no_answer',note:' Arandı '};
test('conversation captures an outcome without manufacturing availability or a placement',()=>{
 assert.equal(m.validateConversation(input).note,'Arandı');
 for(const extra of [{available:true},{actorId:id(5)},{recordedAt:'2026-09-15'}])assert.throws(()=>m.validateConversation({...input,...extra}));
});
test('declining a job requires that specific request; malformed values fail',()=>{
 assert.throws(()=>m.validateConversation({...input,outcome:'declined'}));
 assert.equal(m.validateConversation({...input,outcome:'declined',requestId:id(3)}).requestId,id(3));
 for(const patch of [{channel:'__proto__'},{outcome:'accepted'},{note:'x'.repeat(2001)},{note:'\0'},{requestId:''},{commandId:null}])assert.throws(()=>m.validateConversation({...input,...patch}));
});
test('response belongs to requested tenant/person and contains a real server actor/time',()=>{
 const scope={actorId:id(4),tenantId:id(5)},value={...input,id:id(6),tenantId:id(5),actorId:id(4),recordedAt:'2026-09-15T00:00:00Z'};
 assert.equal(m.parseConversation(value,scope,id(2)).id,id(6));
 for(const patch of [{tenantId:id(7)},{personId:id(7)},{recordedAt:'n/a'},{actorId:null}])assert.throws(()=>m.parseConversation({...value,...patch},scope,id(2)));
});

test('history rejects mixed people, duplicate ids and oversized responses',()=>{
 const scope={actorId:id(4),tenantId:id(5)},row={...input,id:id(6),tenantId:id(5),actorId:id(4),recordedAt:'2026-09-15T00:00:00Z'};
 assert.deepEqual(m.parseConversationList([],scope,id(2)),[]);
 assert.equal(m.parseConversationList([row],scope,id(2)).length,1);
 for(const value of [null,[row,row],[{...row,personId:id(9)}],Array(22).fill(row)])assert.throws(()=>m.parseConversationList(value,scope,id(2)));
});
