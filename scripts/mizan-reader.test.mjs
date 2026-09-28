import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {readMizan}=await importActualTypeScript(new URL('../src/lib/luca/read-mizan.ts',import.meta.url));
const input=()=>({bytes:new ArrayBuffer(2),name:'test.xlsx',companies:[]});
function worker(){return {terminated:0,postMessage(data,transfer){assert.equal(transfer[0],data.bytes);},terminate(){this.terminated++;}};}
test('successful reader transfers bytes and terminates after its single result',async()=>{
 const w=worker(),promise=readMizan(input(),new AbortController().signal,()=>w);
 const result={rows:[],errors:[],meta:{}};w.onmessage({data:{ok:true,result}});
 assert.equal(await promise,result);assert.equal(w.terminated,1);
});
test('cancellation terminates and ignores late worker success',async()=>{
 const controller=new AbortController(),w=worker(),promise=readMizan(input(),controller.signal,()=>w);
 controller.abort();w.onmessage({data:{ok:true,result:{rows:[],errors:[]}}});
 await assert.rejects(promise,/iptal/);assert.equal(w.terminated,1);
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(readMizan(input(),cancelled.signal,()=>{assert.fail('must not start');}));
});
test('timeout and corrupt protocol fail without synchronous fallback',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const w=worker(),promise=readMizan(input(),new AbortController().signal,()=>w);
 const rejection=assert.rejects(promise,/15 saniye/);t.mock.timers.tick(15000);await rejection;assert.equal(w.terminated,1);
 const bad=worker(),p=readMizan(input(),new AbortController().signal,()=>bad);bad.onmessage({data:{ok:true}});await assert.rejects(p,/geçersiz/);assert.equal(bad.terminated,1);
 await assert.rejects(readMizan(input(),new AbortController().signal,()=>{throw Error('blocked');}),/başlatılamadı/);
});
