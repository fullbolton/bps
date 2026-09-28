import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {documentStatusForFile,currentDocumentStatus,withCurrentDocumentStatus}=await importActualTypeScript(new URL('../src/lib/document-validity.ts',import.meta.url));
const now=new Date('2026-09-15T09:00:00Z');
const row={status:'tam',storage_path:'test/document.pdf',validity_date:'2026-09-15'};
test('Istanbul expiry includes day zero and thirty, expires on following day',()=>{
 for(const [date,status] of [['2026-10-16','tam'],['2026-10-15','suresi_yaklsiyor'],['2026-09-15','suresi_yaklsiyor'],['2026-09-14','suresi_doldu']])assert.equal(documentStatusForFile(date,now),status);
});
test('expiry changes at Istanbul midnight instead of UTC midnight',()=>{
 assert.equal(documentStatusForFile('2026-09-15',new Date('2026-09-15T20:59:59Z')),'suresi_yaklsiyor');
 assert.equal(documentStatusForFile('2026-09-15',new Date('2026-09-15T21:00:00Z')),'suresi_doldu');
});
test('stored complete does not keep an expired document green and mapping does not mutate raw data',()=>{
 const result=withCurrentDocumentStatus(row,new Date('2026-11-15T12:00:00Z'));
 assert.equal(result.status,'suresi_doldu');assert.equal(row.status,'tam');
 assert.equal(currentDocumentStatus({...row,status:'suresi_doldu',validity_date:'2027-01-01'},now),'tam');
});
test('missing file and explicit missing status take priority; undated manual state stays intact',()=>{
 assert.equal(currentDocumentStatus({...row,storage_path:null},now),'eksik');
 assert.equal(currentDocumentStatus({...row,status:'eksik'},now),'eksik');
 assert.equal(currentDocumentStatus({...row,status:'suresi_yaklsiyor',validity_date:null},now),'suresi_yaklsiyor');
 assert.throws(()=>currentDocumentStatus({...row,validity_date:'2026-02-30'},now));
});
