import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {blockedPersonCode,requireSafePersonCode,PERSON_CODE_MESSAGE}=await importActualTypeScript(new URL('../src/lib/project-reporting/person-code.ts',import.meta.url));
const {normalizeActualSheet}=await importActualTypeScript(new URL('../src/lib/project-reporting/source-rows.ts',import.meta.url));
const {importError}=await importActualTypeScript(new URL('../src/lib/project-reporting/import-view.ts',import.meta.url));
test('eleven-digit numeric codes are blocked without collecting or validating identity',()=>{
 for(const value of ['00000000000','000 000 000 00','(000)-000.000-00','０００００００００００','\u00a000000000000\u00a0']){assert.equal(blockedPersonCode(value),true);assert.throws(()=>requireSafePersonCode(value),/REPORT_PERSON_CODE_PRIVATE/);}
});
test('ordinary business codes, dates and UUIDs are not reclassified as identities',()=>{
 for(const value of ['007','MEK-007','P-00000000000','0000000000','000000000000','2026-09-28','00000000-0000-4000-8000-000000000001',null,undefined])assert.equal(blockedPersonCode(value),false);
});
test('spreadsheet row is held with field message and no accepted value',()=>{
 const mapping={sourceId:0,locationCode:1,personCode:2,day:3,slotCode:4,minutes:5};
 const sheet={name:'CSV',hidden:false,rows:[{number:1,cells:['a','b','c','d','e','f'].map(value=>({value}))},{number:2,cells:['r1','branch','00000000000','2026-09-01','day','480'].map(value=>({value}))}]};
 const row=normalizeActualSheet(sheet,1,mapping,'minutes','2026-09')[0];assert.equal(row.value,null);assert.ok(row.issues.includes(PERSON_CODE_MESSAGE));assert.ok(!row.issues.join('').includes('00000000000'));
});
test('database rejection is translated without echoing the input',()=>{assert.equal(importError({message:'REPORT_PERSON_CODE_PRIVATE'}),PERSON_CODE_MESSAGE);});
