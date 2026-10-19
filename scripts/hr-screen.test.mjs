import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseHrScreen:parse}=await importActualTypeScript(new URL('../src/lib/services/hr-screen.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('HR screen accepts only coherent server routes and rejects foreign context',()=>{
 const r={schemaVersion:1,actorId:id(1),tenantId:id(2),mode:'scoped',manager:false,writeMode:'scoped'};
 assert.equal(parse(r,id(1),id(2)).writeMode,'scoped');assert.equal(parse({...r,manager:true,writeMode:'legacy'},id(1),id(2)).writeMode,'legacy');
 for(const patch of [{actorId:id(3)},{mode:'unknown'},{manager:'true'},{writeMode:'legacy'},{mode:'legacy'},{schemaVersion:2}])assert.throws(()=>parse({...r,...patch},id(1),id(2)));
});
