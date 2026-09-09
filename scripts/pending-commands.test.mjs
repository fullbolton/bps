import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {reserveCommand,acknowledgeCommand,pendingCount}=await importActualTypeScript(new URL('../src/lib/operations/pending-commands.ts',import.meta.url));
const scope={actorId:'00000000-0000-0000-0000-000000000001',tenantId:'00000000-0000-0000-0000-000000000002'};
function fixture(){const disk=new Map(),queues=new Map();return {disk,storage:{getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},locks:{request(k,fn){const task=(queues.get(k)??Promise.resolve()).then(fn);queues.set(k,task.catch(()=>{}));return task;}}};}
test('fresh adapter after reload reuses persisted identity without storing form text',async()=>{const f=fixture(),payload={name:'Synthetic secret name',code:'P1'};const a=await reserveCommand(scope,'worker',payload,f.storage,f.locks);const fresh={getItem:k=>f.disk.get(k)??null,setItem:(k,v)=>f.disk.set(k,v)};assert.equal(await reserveCommand(scope,'worker',payload,fresh,f.locks),a);assert.equal(pendingCount(scope,fresh),1);assert.ok(!JSON.stringify([...f.disk]).includes(payload.name));});
test('canonical object key order is stable; changed payload and kind are distinct',async()=>{const f=fixture();const a=await reserveCommand(scope,'x',{a:1,b:2},f.storage,f.locks);assert.equal(await reserveCommand(scope,'x',{b:2,a:1},f.storage,f.locks),a);assert.notEqual(await reserveCommand(scope,'x',{a:2,b:2},f.storage,f.locks),a);assert.notEqual(await reserveCommand(scope,'y',{a:1,b:2},f.storage,f.locks),a);});
test('different account and tenant never borrow identity',async()=>{const f=fixture(),a=await reserveCommand(scope,'x',{},f.storage,f.locks);for(const s of [{...scope,actorId:scope.tenantId},{...scope,tenantId:scope.actorId}])assert.notEqual(await reserveCommand(s,'x',{},f.storage,f.locks),a);});
test('concurrent tabs reserve a single identity through shared lock',async()=>{const f=fixture();const ids=await Promise.all(Array.from({length:20},()=>reserveCommand(scope,'x',{},f.storage,f.locks)));assert.equal(new Set(ids).size,1);assert.equal(pendingCount(scope,f.storage),1);});
test('acknowledgment removes only confirmed command; next identical intent has new identity',async()=>{const f=fixture(),a=await reserveCommand(scope,'x',{},f.storage,f.locks),b=await reserveCommand(scope,'y',{},f.storage,f.locks);await acknowledgeCommand(scope,a,f.storage,f.locks);assert.equal(pendingCount(scope,f.storage),1);assert.equal(await reserveCommand(scope,'y',{},f.storage,f.locks),b);assert.notEqual(await reserveCommand(scope,'x',{},f.storage,f.locks),a);});
test('blocked read/write and missing locks reject without volatile fallback',async()=>{const f=fixture();await assert.rejects(()=>reserveCommand(scope,'x',{}, {getItem(){throw Error('blocked');},setItem(){}},f.locks));await assert.rejects(()=>reserveCommand(scope,'x',{}, {getItem:()=>null,setItem(){throw Error('quota');}},f.locks));await assert.rejects(()=>reserveCommand(scope,'x',{},f.storage,undefined));assert.equal(f.disk.size,0);});
test('malformed stored records fail closed',async()=>{for(const raw of ['{','null','[{}]',JSON.stringify([{id:scope.actorId,digest:'a'.repeat(64)},{id:scope.tenantId,digest:'a'.repeat(64)}])]){const f=fixture();await reserveCommand(scope,'x',{},f.storage,f.locks);f.disk.set([...f.disk.keys()][0],raw);await assert.rejects(()=>reserveCommand(scope,'y',{},f.storage,f.locks));}});
test('50 pending limit preserves old identities and blocks new writes',async()=>{const f=fixture();for(let i=0;i<50;i++)await reserveCommand(scope,'x',{i},f.storage,f.locks);await assert.rejects(()=>reserveCommand(scope,'x',{i:50},f.storage,f.locks));await reserveCommand(scope,'x',{i:0},f.storage,f.locks);assert.equal(pendingCount(scope,f.storage),50);});
test('failed acknowledgment retains original identity for safe retry',async()=>{const f=fixture(),a=await reserveCommand(scope,'x',{},f.storage,f.locks);await assert.rejects(()=>acknowledgeCommand(scope,a,{...f.storage,setItem(){throw Error('quota');}},f.locks));assert.equal(await reserveCommand(scope,'x',{},f.storage,f.locks),a);});

test('reconciliation clears only terminal requested IDs; unknown and concurrent additions survive',async()=>{
  const {reconcilePending,pendingCommandIds}=await importActualTypeScript(new URL('../src/lib/operations/pending-commands.ts',import.meta.url));
  const f=fixture(),a=await reserveCommand(scope,'a',{},f.storage,f.locks),b=await reserveCommand(scope,'b',{},f.storage,f.locks),c=await reserveCommand(scope,'c',{},f.storage,f.locks);
  const snapshot=pendingCommandIds(scope,f.storage);const d=await reserveCommand(scope,'d',{},f.storage,f.locks);
  assert.deepEqual(await reconcilePending(scope,snapshot,[{id:a,status:'confirmed'},{id:b,status:'closed'},{id:c,status:'unknown'}],f.storage,f.locks),{confirmed:1,closed:1,unknown:1});
  assert.deepEqual(pendingCommandIds(scope,f.storage),[c,d]);
});
test('malformed, omitted, duplicate, foreign, and non-terminal-looking statuses preserve all pending identities',async()=>{
  const {reconcilePending}=await importActualTypeScript(new URL('../src/lib/operations/pending-commands.ts',import.meta.url));
  const f=fixture(),a=await reserveCommand(scope,'a',{},f.storage,f.locks),b=await reserveCommand(scope,'b',{},f.storage,f.locks);
  for(const value of [null,[],[{id:a,status:'confirmed'}],[{id:a,status:'confirmed'},{id:a,status:'confirmed'}],[{id:a,status:'confirmed'},{id:scope.actorId,status:'closed'}],[{id:a,status:'confirmed'},{id:b,status:'true'}]]){
    await assert.rejects(()=>reconcilePending(scope,[a,b],value,f.storage,f.locks));assert.equal(pendingCount(scope,f.storage),2);
  }
});
test('reconciliation storage failure keeps recoverable identity',async()=>{
  const {reconcilePending}=await importActualTypeScript(new URL('../src/lib/operations/pending-commands.ts',import.meta.url));
  const f=fixture(),a=await reserveCommand(scope,'a',{},f.storage,f.locks);
  await assert.rejects(()=>reconcilePending(scope,[a],[{id:a,status:'confirmed'}],{...f.storage,setItem(){throw Error('quota');}},f.locks));
  assert.equal(pendingCount(scope,f.storage),1);
});
