import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parseDashboardActivity,activityLabel}=await importActualTypeScript(new URL('../src/lib/dashboard-activity.ts',import.meta.url));
const row={id:'task:1:0',at:'2026-09-09T10:00:00Z',kind:'task:created',title:'Takip',href:'/gorevler'};
test('activity empty differs from unavailable or malformed response',()=>{
 assert.deepEqual(parseDashboardActivity([]),[]);assert.deepEqual(parseDashboardActivity([row]),[row]);
 for(const v of [null,{},[row,row],[{...row,at:'bad'}],[{...row,title:42}],[{...row,href:'https://example.com'}],[{...row,href:'//example.com'}]])assert.throws(()=>parseDashboardActivity(v));
 assert.throws(()=>parseDashboardActivity(Array.from({length:21},(_,i)=>({...row,id:String(i)}))));
});
test('activity labels distinguish ownership events without claiming task completion',()=>{
 assert.equal(activityLabel('task:created'),'Görev oluşturuldu');assert.equal(activityLabel('task:reassigned'),'Görev devredildi');assert.equal(activityLabel('unknown'),'İşlem kaydedildi');
 assert.equal(parseDashboardActivity([{...row,href:'/talepler/gunluk',kind:'ops:attendance'}]).length,1);
});
