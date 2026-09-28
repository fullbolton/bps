import test from 'node:test';import assert from 'node:assert/strict';import{importActualTypeScript}from'./helpers/import-typescript.mjs';
const{parseWorkDetails}=await importActualTypeScript(new URL('../src/lib/project-reporting/work-details.ts',import.meta.url));
const id='00000000-0000-4000-8000-000000000001',row={day:'2026-09-10',personId:id,personName:'Kişi',locationId:id,locationName:'Şube',slot:'day',minutes:480,source:'puantaj',sourceId:'r1',batchId:id};
const data={tenantId:id,projectId:id,month:'2026-09',locationId:null,offset:0,total:1,rows:[row]};
test('work details fail on missing pages, duplicates, wrong scope and invalid durations',()=>{const parse=v=>parseWorkDetails(v,id,id,'2026-09',null,0);assert.equal(parse(data).total,1);for(const v of [{...data,rows:[]},{...data,tenantId:'wrong'},{...data,total:2,rows:[row,row]},{...data,rows:[{...row,minutes:null}]},{...data,rows:[{...row,day:'2026-10-01'}]}])assert.throws(()=>parse(v));});
