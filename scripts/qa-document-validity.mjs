import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const exports=await importActualTypeScript(new URL('../src/lib/document-validity.ts',import.meta.url));
const {isDocumentValidityDate:valid,documentStatusForFile:status}=exports;
for(const value of ['','2026-02-29','2026-02-30','2026-13-01','2026-9-01','0000-01-01','2026-09-11T00:00:00Z'])assert.equal(valid(value),false,value);
for(const value of ['2024-02-29','2026-09-11','0001-01-01','9999-12-31'])assert.equal(valid(value),true,value);
const now=new Date('2026-09-11T12:00:00Z');for(const [date,result] of [[null,'tam'],['2026-09-10','suresi_doldu'],['2026-09-11','suresi_yaklsiyor'],['2026-10-11','suresi_yaklsiyor'],['2026-10-12','tam']])assert.equal(status(date,now),result);
assert.throws(()=>status('2026-02-30',now));console.log('PASS strict ISO date/leap year/year-zero rejection and Istanbul expiry day 0/30/31 boundaries');
