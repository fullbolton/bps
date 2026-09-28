import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const api=await importActualTypeScript(new URL('../src/lib/notifications/inbox-state.ts',import.meta.url));
const {parseInbox}=await importActualTypeScript(new URL('../src/lib/operations/conversation-read.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)};
const item=(n,read_at=null)=>({message_id:id(n),request_id:id(3),company_id:id(4),company_name:'Firma',work_date:'2026-09-28',body:'Not',created_at:'2026-09-28T08:00:00Z',read_at});
function shared(){const data=new Map();let queue=Promise.resolve();return {storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},locks:{request(_key,fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}},data};}
test('initial snapshot and refresh are silent; only newly observed unread IDs sound',()=>{
 const baseline=api.observeInbox(null,[item(10),item(11)]);assert.deepEqual(baseline.fresh,[]);
 assert.deepEqual(api.observeInbox(baseline.seen,[item(10),item(11)]).fresh,[]);
 assert.deepEqual(api.observeInbox(baseline.seen,[item(12),item(13,'2026-09-28T08:01:00Z'),item(10)]).fresh,[id(12)]);
 assert.deepEqual(api.observeInbox(null,[item(12)]).fresh,[]);
});
test('scope keys separate companies and users; response mismatch fails closed',()=>{
 assert.notEqual(api.inboxScopeKey(scope),api.inboxScopeKey({...scope,tenantId:id(9)}));
 assert.throws(()=>api.assertInboxScope({...scope,actorId:id(9)},scope));
 assert.throws(()=>api.assertInboxScope({...scope,tenantId:id(9)},scope));
 assert.doesNotThrow(()=>api.assertInboxScope(scope,scope));
});
test('links contain only a verified internal request target, company and date',()=>{
 const href=api.inboxHref(item(10));assert.ok(href.startsWith('/talepler/gunluk?'));assert.ok(href.endsWith('#talep-'+id(3)));
 assert.throws(()=>api.inboxHref({...item(10),request_id:'https://outside.test'}));
});
test('two tabs observing the same event play once; rapid batches are consumed silently',async()=>{
 const {storage,locks}=shared();let sounds=0;const play=()=>{sounds++;return true;};
 const result=await Promise.all([api.playInboxSoundOnce(scope,[id(10)],storage,locks,play,100000),api.playInboxSoundOnce(scope,[id(10)],storage,locks,play,100000)]);
 assert.equal(result.filter(Boolean).length,1);assert.equal(sounds,1);
 assert.equal(await api.playInboxSoundOnce(scope,[id(11),id(12)],storage,locks,play,110000),false);
 assert.equal(await api.playInboxSoundOnce(scope,[id(11),id(12)],storage,locks,play,180000),false);
 assert.equal(await api.playInboxSoundOnce(scope,[id(13)],storage,locks,play,180000),true);assert.equal(sounds,2);
});
test('storage or locking failure never falls back to uncoordinated sound',async()=>{
 let sounds=0;const play=()=>{sounds++;return true;};const {storage,locks}=shared();
 await assert.rejects(api.playInboxSoundOnce(scope,[id(10)],storage,null,play));
 await assert.rejects(api.playInboxSoundOnce(scope,[id(10)],{getItem:()=>'{broken',setItem(){}},locks,play));
 await assert.rejects(api.playInboxSoundOnce(scope,[id(10)],{getItem:()=>null,setItem(){throw Error('full');}},locks,play));
 assert.equal(sounds,0);
});
test('shared ledger stores only bounded event IDs and time, never message content',async()=>{
 const {storage,locks,data}=shared();await api.playInboxSoundOnce(scope,Array.from({length:400},(_,i)=>id(i+10)),storage,locks,()=>true,100000);
 const value=JSON.parse([...data.values()][0]);assert.equal(value.ids.length,300);assert.deepEqual(Object.keys(value).sort(),['ids','lastSoundAt']);
});
test('duplicate inbox rows are rejected instead of doubling counters or cards',()=>{
 assert.throws(()=>parseInbox({unread:2,items:[item(10),item(10)]}));
 assert.equal(parseInbox({unread:1,items:[item(10)]}).items.length,1);
});
test('impossible calendar day cannot reach the date formatter or deep link',()=>{
 assert.throws(()=>parseInbox({unread:1,items:[{...item(10),work_date:'2026-02-30'}]}));
 assert.throws(()=>api.inboxHref({...item(10),work_date:'2026-13-01'}));
});
