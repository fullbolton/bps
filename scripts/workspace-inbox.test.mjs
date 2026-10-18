import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseWorkspaceInbox,parseInboxCursor,inboxEventKey,observeWorkspaceInbox,playWorkspaceInboxSoundOnce}=await importActualTypeScript(new URL('../src/lib/notifications/workspace-inbox.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={actorId:id(1),tenantId:id(2)};
const item=(n=3,kind='task_assignment')=>({kind,id:id(n),created_at:'2026-10-18T01:02:03.123456+00:00',read_at:null,payload:kind==='task_assignment'?{taskId:id(4),title:'Görev'}:kind==='announcement'?{announcementId:id(4),body:'Duyuru'}:{requestId:id(4),companyId:id(5),companyName:'Firma',workDate:'2026-10-18',body:'Mesaj'}});
const page=(items=[item()])=>({...scope,items,unread:items.length,nextCursor:null});
test('all three source types are parsed without fake company fields',()=>{const v=parseWorkspaceInbox(page([item(3),item(4,'announcement'),item(5,'conversation')]),scope);assert.equal(v.items.length,3);assert.equal('companyId' in v.items[0].payload,false);assert.equal(v.items[2].payload.companyName,'Firma');});
test('same UUID across source types is distinct, same kind duplicates fail',()=>{const v=parseWorkspaceInbox(page([item(),item(3,'announcement')]),scope);assert.notEqual(inboxEventKey(v.items[0]),inboxEventKey(v.items[1]));assert.throws(()=>parseWorkspaceInbox(page([item(),item()]),scope));});
test('wrong scope and malformed or incomplete results are rejected',()=>{for(const patch of [{actorId:id(9)},{tenantId:id(9)},{unread:'1'},{unread:-1},{unread:0},{unread:NaN},{unread:Number.MAX_SAFE_INTEGER+1},{items:null},{nextCursor:undefined}])assert.throws(()=>parseWorkspaceInbox({...page(),...patch},scope));for(const patch of [{kind:'other'},{id:'x'},{created_at:'yesterday'},{created_at:'2026-02-31T00:00:00Z'},{read_at:undefined},{payload:{}},{payload:{taskId:id(4),title:''}}])assert.throws(()=>parseWorkspaceInbox(page([{...item(),...patch}]),scope));assert.throws(()=>parseWorkspaceInbox(page(Array.from({length:31},(_,i)=>item(10+i))),scope));});
test('cursor must identify the last item of a full page',()=>{const items=Array.from({length:30},(_,i)=>item(10+i));const good={...page(items),nextCursor:{kind:'task_assignment',id:id(39)}};assert.equal(parseWorkspaceInbox(good,scope).nextCursor.id,id(39));assert.throws(()=>parseWorkspaceInbox({...good,nextCursor:{kind:'announcement',id:id(39)}},scope));assert.throws(()=>parseWorkspaceInbox({...page(),nextCursor:{kind:'task_assignment',id:id(3)}},scope));assert.throws(()=>parseInboxCursor({id:id(3)}));assert.equal(parseInboxCursor(null),null);});
test('initial snapshot silent; new unread types qualify separately; read items silent',()=>{const a=parseWorkspaceInbox(page(),scope).items;const first=observeWorkspaceInbox(null,a);assert.deepEqual(first.fresh,[]);const b=parseWorkspaceInbox(page([item(),item(3,'announcement'),{...item(5,'conversation'),read_at:'2026-10-18T02:00:00Z'}]),scope).items;assert.deepEqual(observeWorkspaceInbox(first.seen,b).fresh,['announcement:'+id(3)]);assert.deepEqual(observeWorkspaceInbox(observeWorkspaceInbox(first.seen,b).seen,b).fresh,[]);});
test('invalid conversation target and announcement body fail closed; unknown payload fields are not retained',()=>{for(const changed of [{...item(3,'conversation'),payload:{...item(3,'conversation').payload,workDate:'2026-02-31'}},{...item(3,'announcement'),payload:{announcementId:id(4),body:null}}])assert.throws(()=>parseWorkspaceInbox(page([changed]),scope));const input=item();input.payload.internalSecret='not public';assert.equal('internalSecret' in parseWorkspaceInbox(page([input]),scope).items[0].payload,false);});

test('typed sound keys serialize tabs, preserve burst suppression, and separate source UUID collisions',async()=>{
 const values=new Map();const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 let pending=Promise.resolve(),played=0;const locks={request(_key,fn){const result=pending.then(fn);pending=result.catch(()=>{});return result;}};
 const a='task_assignment:'+id(7),b='announcement:'+id(7),play=()=>{played++;return true;};
 assert.deepEqual(await Promise.all([playWorkspaceInboxSoundOnce(scope,[a],storage,locks,play,1000),playWorkspaceInboxSoundOnce(scope,[a],storage,locks,play,1000)]),[true,false]);
 assert.equal(await playWorkspaceInboxSoundOnce(scope,[b],storage,locks,play,61001),true);
 assert.equal(await playWorkspaceInboxSoundOnce(scope,['conversation:'+id(8)],storage,locks,play,61002),false);
 assert.equal(await playWorkspaceInboxSoundOnce(scope,['conversation:'+id(8)],storage,locks,play,122000),false);assert.equal(played,2);
 assert.ok([...values.keys()].every(x=>x.startsWith('bps:workspace-inbox-sound:v1:')));
});
test('typed sound rejects malformed storage and event keys before playback',async()=>{
 let played=0;const locks={request:async(_key,fn)=>fn()};const play=()=>{played++;return true;};
 await assert.rejects(playWorkspaceInboxSoundOnce(scope,[id(7)],{getItem:()=>null,setItem(){}},locks,play));
 await assert.rejects(playWorkspaceInboxSoundOnce(scope,['announcement:'+id(7)],{getItem:()=>JSON.stringify({ids:[id(7)],lastSoundAt:0}),setItem(){}},locks,play));assert.equal(played,0);
});
