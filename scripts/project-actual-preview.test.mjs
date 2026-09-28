import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {previewActualRows}=await importActualTypeScript(new URL('../src/lib/project-reporting/actual-preview.ts',import.meta.url));
const scope={tenantId:'mek',projectId:'bank',sourceId:'puantaj',month:'2026-09'};
const row={sourceId:'record-1',locationCode:'001',personCode:'007',day:'2026-09-01',slotCode:'day',minutes:480};
const snap=(rows=[])=>({scope,complete:true,rows});
test('new, repeated and corrected files remain distinct',()=>{
 assert.equal(previewActualRows(scope,[row],snap()).rows[0].status,'new');
 assert.equal(previewActualRows(scope,[row],snap([row])).rows[0].status,'unchanged');
 const correction=previewActualRows(scope,[{...row,minutes:420}],snap([row])).rows[0];
 assert.equal(correction.status,'changed'); assert.equal(correction.previous.minutes,480);
});
test('rejects other tenant/project/source/month and partial snapshots',()=>{
 for(const field of Object.keys(scope)) assert.throws(()=>previewActualRows(scope,[row],{...snap(),scope:{...scope,[field]:'other'}}));
 assert.throws(()=>previewActualRows(scope,[row],{...snap(),complete:false}));
});
test('both copies are blocked; changed source identity cannot duplicate work',()=>{
 assert.deepEqual(previewActualRows(scope,[row,row],snap()).rows.map(r=>r.status),['review','review']);
 assert.equal(previewActualRows(scope,[{...row,sourceId:'new-id'}],snap([row])).rows[0].status,'review');
 assert.equal(previewActualRows(scope,[{...row,personCode:'008'}],snap([row])).rows[0].status,'review');
});
test('missing is not zero; malformed dates and durations are blocked',()=>{
 for(const minutes of [null,undefined,'480',NaN,-1,1441,1.5]) assert.equal(previewActualRows(scope,[{...row,minutes}],snap()).rows[0].status,'review');
 assert.equal(previewActualRows(scope,[{...row,minutes:0}],snap()).rows[0].status,'new');
 for(const day of ['2026-09-31','2026-08-31','01.09.2026']) assert.equal(previewActualRows(scope,[{...row,day}],snap()).rows[0].status,'review');
});
test('omitted rows remain visible without deletion; corrupt snapshots fail',()=>{
 const result=previewActualRows(scope,[],snap([row]));
 assert.deepEqual(result.rows,[]);assert.deepEqual(result.missingFromUpload,[row]);
 assert.throws(()=>previewActualRows(scope,[],snap([row,row])));
});
test('multiple slots are separate; leading zero codes are preserved',()=>{
 const result=previewActualRows(scope,[row,{...row,sourceId:'record-2',slotCode:'night'}],snap());
 assert.deepEqual(result.rows.map(r=>r.status),['new','new']);
 assert.equal(result.rows[0].value.personCode,'007');
});
