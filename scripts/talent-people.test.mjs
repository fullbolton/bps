import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
import {id} from './fixtures/daily-operations.mjs';
const m=await importActualTypeScript(new URL('../src/lib/talent/people.ts',import.meta.url));
test('name-only records preserve unknown contacts, region and work type',()=>{
 const p=m.validatePersonInput({...m.emptyPerson,name:'  Örnek Kişi  '});assert.equal(p.name,'Örnek Kişi');assert.deepEqual(p.contacts,[]);assert.equal(p.city,null);assert.deepEqual(p.workTypes,[]);
});
test('invalid contacts, hidden extra fields and unsupported work types are rejected',()=>{
 for(const patch of [{contacts:[{kind:'email',value:'broken'}]},{contacts:[{kind:'phone',value:'abc'}]},{contacts:null},{name:'X\nY'},{workTypes:['x']},{skills:[null]},{secret:true}])assert.throws(()=>m.validatePersonInput({...m.emptyPerson,name:'Test',...patch}));
});
test('page completeness, duplicate IDs, foreign scope and null RPC results fail closed',()=>{
 const scope={actorId:id(10),tenantId:id(1)},query=m.initialQuery,person={...m.emptyPerson,name:'Test',id:id(2),tenantId:id(1),revision:0,workerId:null,workerCode:null,workerActive:null,source:'manual',createdAt:'2026-09-14T00:00:00Z',updatedAt:'2026-09-14T00:00:00Z'};
 const p={tenantId:id(1),query,total:1,rows:[person],generatedAt:person.createdAt};assert.equal(m.parsePeoplePage(p,scope,query).rows.length,1);
 for(const value of [null,{...p,total:2},{...p,total:2,rows:[person,person]},{...p,rows:[{...person,tenantId:id(3)}]}])assert.throws(()=>m.parsePeoplePage(value,scope,query));
});
test('recovery only confirms the expected person, command and revision',()=>{
 const pending={commandId:id(2),personId:id(3),expectedRevision:5};
 assert.deepEqual(m.parsePersonResolution({status:'confirmed',receipt:{id:id(3),commandId:id(2),revision:6}},pending).receipt.revision,6);
 for(const x of [{status:'confirmed',receipt:{id:id(4),commandId:id(2),revision:6}},{status:'confirmed',receipt:{id:id(3),commandId:id(2),revision:5}},{status:'closed',commandId:id(5)},null])assert.throws(()=>m.parsePersonResolution(x,pending));
});
