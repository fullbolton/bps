import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {createNavigationGuard}=await importActualTypeScript(new URL('../src/lib/navigation-guard.ts',import.meta.url));
test('route remount uses current workspace; stale cleanup cannot remove its protection',()=>{
 const guard=createNavigationGuard(),events=[];
 const old=guard.register(e=>events.push('old:'+e));
 const current=guard.register(e=>events.push('current:'+e));
 old();guard.handle('click');assert.deepEqual(events,['current:click']);
 current();guard.handle('after unmount');assert.deepEqual(events,['current:click']);
});
test('navigation decision keeps the original event and synchronous cancellation',()=>{
 const guard=createNavigationGuard();const event={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};
 guard.handle(event);assert.equal(event.defaultPrevented,false);
 guard.register(e=>{assert.equal(e,event);e.preventDefault();});
 guard.handle(event);assert.equal(event.defaultPrevented,true);
});
