import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {buildImportRequest}=await importActualTypeScript(new URL('../src/lib/talent/import-request.ts',import.meta.url));
const {previewSource}=await importActualTypeScript(new URL('../src/lib/talent/import-preview.ts',import.meta.url));
const {compareSourcePeople}=await importActualTypeScript(new URL('../src/lib/talent/import-compare.ts',import.meta.url));
const row=previewSource({name:'Synthetic',hidden:false,rows:[{number:1,cells:['Name','Phone','Email','City'].map(value=>({value}))},{number:2,cells:['Reddedilen Kaynak Ad','05550000001','rejected@example.invalid','Ankara'].map(value=>({value}))}]},1,'people',{name:0,phone:1,email:2,city:3}).rows;
const id='00000000-0000-4000-8000-000000000003';
const snapshot={actorId:'00000000-0000-4000-8000-000000000001',tenantId:'00000000-0000-4000-8000-000000000002',total:1,generatedAt:'2026-09-15T00:00:00Z',rows:[{id,revision:4,name:'Kayıtlı Ad',city:'İstanbul',contacts:[{kind:'phone',value:'05550000001'}]}]};
test('existing city-only import excludes rejected source name and contact values from the actual request',async()=>{
 const candidate=compareSourcePeople(row,snapshot)[0].candidates[0];
 const cityIndex=candidate.differences.findIndex(d=>d.field==='city');
 const result=await buildImportRequest(row,snapshot,{2:{kind:'existing',personId:id,changes:[cityIndex]}});
 assert.deepEqual(result.rows[0].source,{name:'Kayıtlı Ad',city:'Ankara',phone:'',email:''});
 assert.deepEqual(result.rows[0].fields,['city']);assert.equal(result.rows[0].expectedRevision,4);
 for(const excluded of ['Reddedilen Kaynak Ad','05550000001','rejected@example.invalid'])assert.equal(JSON.stringify(result).includes(excluded),false);
});
test('selected email is retained, unchanged rows send only stored name, hold rows send no personal data',async()=>{
 const candidate=compareSourcePeople(row,snapshot)[0].candidates[0];
 const emailIndex=candidate.differences.findIndex(d=>d.field==='contacts'&&d.after==='rejected@example.invalid');
 const selected=await buildImportRequest(row,snapshot,{2:{kind:'existing',personId:id,changes:[emailIndex]}});
 assert.equal(selected.rows[0].source.email,'rejected@example.invalid');assert.equal(selected.rows[0].source.phone,'');
 const unchanged=await buildImportRequest(row,snapshot,{2:{kind:'existing',personId:id,changes:[]}});
 assert.deepEqual(unchanged.rows[0].source,{name:'Kayıtlı Ad',city:'',phone:'',email:''});
 const held=await buildImportRequest(row,snapshot,{2:{kind:'hold'}});assert.deepEqual(held.rows,[{number:2,kind:'hold'}]);
 assert.notEqual(selected.sourceHash,unchanged.sourceHash);
});
