import test from 'node:test';import assert from 'node:assert/strict';import{importActualTypeScript}from'./helpers/import-typescript.mjs';
const {parseMonthlyReport,workDuration}=await importActualTypeScript(new URL('../src/lib/project-reporting/monthly-view.ts',import.meta.url));
const id='00000000-0000-4000-8000-000000000001';
const v={tenantId:id,projectId:id,name:'Proje',month:'2026-09',status:'open',pending:1,offset:0,totals:{records:1,minutes:420,people:1,days:1,branches:1},rows:[{id,name:'Şube',records:1,minutes:420,people:1,days:1}]};
const parse=d=>parseMonthlyReport(d,id,id,'2026-09',0);
test('monthly report rejects incomplete, inconsistent or wrong-scope totals',()=>{assert.equal(parse(v).totals.minutes,420);for(const d of [{...v,tenantId:'other'},{...v,rows:[]},{...v,totals:{...v.totals,minutes:480}},{...v,totals:{...v.totals,minutes:null}},{...v,pending:null},{...v,rows:[...v.rows,...v.rows]}])assert.throws(()=>parse(d));});
test('empty report is explicit and duration retains minutes',()=>{assert.equal(parse({...v,totals:{records:0,minutes:0,people:0,days:0,branches:0},rows:[]}).totals.records,0);assert.equal(workDuration(425),'7 sa 5 dk');assert.equal(workDuration(420),'7 sa');});
