import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {istanbulDay}=await importActualTypeScript(new URL('../src/lib/istanbul-day.ts',import.meta.url));
test('business day is independent of device timezone at Istanbul midnight',()=>{
 assert.equal(istanbulDay(new Date('2026-09-15T20:59:59Z')),'2026-09-15');
 assert.equal(istanbulDay(new Date('2026-09-15T21:00:00Z')),'2026-09-16');
});
test('actual day hook observes timer, wake and visibility changes, then removes listeners',()=>{
 let current='2026-09-15',state,cleanup,tick,cleared=false;
 const windowEvents=new Map(),documentEvents=new Map();
 const target=events=>({addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{assert.equal(events.get(name),fn);events.delete(name);}});
 const window={...target(windowEvents),setInterval(fn,ms){assert.equal(ms,30000);tick=fn;return 42;},clearInterval(id){assert.equal(id,42);cleared=true;}};
 const document={...target(documentEvents),visibilityState:'visible'};
 const exports={};
 const source=readFileSync(new URL('../src/components/ui/useIstanbulDay.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,window,document,require(name){
  if(name==='react')return {useState(init){state=init();return [state,next=>{state=next(state);}];},useEffect(fn){cleanup=fn();}};
  if(name==='@/lib/istanbul-day')return {istanbulDay:()=>current};
  throw Error(name);
 }});
 exports.useIstanbulDay();tick();assert.equal(state,'2026-09-15');
 current='2026-09-16';tick();assert.equal(state,'2026-09-16');
 current='2026-09-17';windowEvents.get('focus')();assert.equal(state,'2026-09-17');
 current='2026-09-18';document.visibilityState='hidden';documentEvents.get('visibilitychange')();assert.equal(state,'2026-09-17');
 document.visibilityState='visible';documentEvents.get('visibilitychange')();assert.equal(state,'2026-09-18');
 cleanup();assert.equal(cleared,true);assert.equal(windowEvents.size,0);assert.equal(documentEvents.size,0);
});
