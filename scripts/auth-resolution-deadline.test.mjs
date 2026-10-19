import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {createAuthResolution}=await importActualTypeScript(new URL('../src/lib/auth-resolution.ts',import.meta.url));
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(t,resolve=async user=>user){
 t.mock.timers.enable({apis:['setTimeout']});const states=[],timeouts=[];
 const flow=createAuthResolution({pending:()=>states.push('pending'),resolve,settled:r=>states.push(r),timedOut:()=>timeouts.push(true)},20_000);
 t.after(()=>flow.dispose());return {flow,states,timeouts};
}
test('hung initial auth expires; late identity cannot restore access',async t=>{
 const {flow,states,timeouts}=setup(t);const auth=deferred();flow.start(()=>auth.promise);
 t.mock.timers.tick(19_999);assert.deepEqual(states,['pending']);t.mock.timers.tick(1);assert.deepEqual(states,['pending',null]);assert.equal(timeouts.length,1);
 auth.resolve('old-user');await flush();assert.deepEqual(states,['pending',null]);
});
test('workspace resolution is bounded too; subsequent auth event can recover',async t=>{
 const old=deferred();const {flow,states,timeouts}=setup(t,u=>u==='old'?old.promise:Promise.resolve(u));flow.change('old');t.mock.timers.tick(0);await flush();t.mock.timers.tick(20_000);assert.equal(states.at(-1),null);
 flow.change('new');t.mock.timers.tick(0);await flush();old.resolve('old');await flush();assert.equal(states.at(-1),'new');t.mock.timers.tick(20_000);assert.equal(timeouts.length,1);
});
test('new event supersedes old deadline and successful verification clears timer',async t=>{
 const {flow,states,timeouts}=setup(t);flow.start(()=>new Promise(()=>{}));t.mock.timers.tick(19_000);flow.change('new');t.mock.timers.tick(0);await flush();t.mock.timers.tick(25_000);assert.equal(states.at(-1),'new');assert.deepEqual(timeouts,[]);
});
test('background verification preserves current view until deadline then fails closed',async t=>{
 const {flow,states,timeouts}=setup(t);flow.start(async()=> 'valid');await flush();flow.recheck(()=>new Promise(()=>{}));assert.deepEqual(states,['pending','valid']);t.mock.timers.tick(20_000);assert.deepEqual(states,['pending','valid',null]);assert.equal(timeouts.length,1);
});
test('sign out settles immediately and disposal prevents later callbacks',async t=>{
 const {flow,states,timeouts}=setup(t);flow.change(null);t.mock.timers.tick(20_000);assert.deepEqual(timeouts,[]);flow.start(()=>new Promise(()=>{}));flow.dispose();t.mock.timers.tick(20_000);assert.deepEqual(states,['pending',null,'pending']);assert.deepEqual(timeouts,[]);
});
