import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const {settleStartFailure}=await importActualTypeScript(new URL('../src/lib/operations/start-failure.ts',import.meta.url));
const {reserveCommand,pendingCommandIds}=await importActualTypeScript(new URL('../src/lib/operations/pending-commands.ts',import.meta.url));
const {startError}=await importActualTypeScript(new URL('../src/lib/operations/start-board.ts',import.meta.url));
const scope={actorId:id(10),tenantId:id(1)},locks={request:async(_name,fn)=>fn()};
async function setup(){const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};const command=await reserveCommand(scope,'start',{assignmentId:id(400),offset:0},storage,locks);return {storage,command};}
test('known rejected command is removed only after terminal server closure',async()=>{
 const {storage,command}=await setup();const r=await settleStartFailure({code:'P0001',message:'START_INPUT'},command,scope,storage,locks,async ids=>{assert.deepEqual(ids,[command]);return [{id:command,status:'closed'}];});
 assert.equal(r.state,'closed');assert.match(r.message,/kaydedilmedi/);assert.deepEqual(pendingCommandIds(scope,storage),[]);
});
test('previous commit wins over a later rejection; never claims not saved',async()=>{
 const {storage,command}=await setup();const r=await settleStartFailure({code:'P0001',message:'START_SCOPE'},command,scope,storage,locks,async()=>[{id:command,status:'confirmed'}]);
 assert.equal(r.state,'confirmed');assert.match(r.message,/daha önce kaydedilmiş/);assert.equal(pendingCommandIds(scope,storage).length,0);
});
test('scope denial, unknown or malformed reconciliation preserve pending identity',async()=>{
 for(const response of [null,[],[{id:id(99),status:'closed'}],'throw','unknown']){
  const {storage,command}=await setup();const r=await settleStartFailure({code:'P0001',message:'START_FORBIDDEN'},command,scope,storage,locks,async()=>{if(response==='throw')throw Error('OPS_SCOPE_CHANGED');return response==='unknown'?[{id:command,status:'unknown'}]:response;});
  assert.equal(r.state,'unknown');assert.deepEqual(pendingCommandIds(scope,storage),[command]);
 }
});
test('network, lock and unknown errors never automatically close a command',async()=>{
 for(const error of [Error('network'),{code:'55P03',message:'lock timeout'},{message:'START_INPUT'},{code:'P0001',message:'START_NEW_UNKNOWN'}]){
  const {storage,command}=await setup();let calls=0;const r=await settleStartFailure(error,command,scope,storage,locks,async()=>{calls++;return [];});assert.equal(calls,0);assert.equal(r.state,'unknown');assert.deepEqual(pendingCommandIds(scope,storage),[command]);
 }
});
test('storage failure after response keeps uncertainty rather than fake cleanup',async()=>{
 const {storage,command}=await setup();const failing={...storage,setItem:()=>{throw Error('quota');}};
 const r=await settleStartFailure({code:'P0001',message:'START_INPUT'},command,scope,failing,locks,async()=>[{id:command,status:'closed'}]);assert.equal(r.state,'unknown');assert.deepEqual(pendingCommandIds(scope,storage),[command]);
});
test('input, witness, replay and plan errors have useful distinct explanations',()=>{
 const messages=['START_INPUT','START_WITNESS','START_REPLAY','START_NO_PLAN','START_ISOLATION'].map(message=>startError({message}));assert.equal(new Set(messages).size,5);assert.ok(messages.every(m=>m!==startError(null)));
});
