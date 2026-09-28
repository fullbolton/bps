import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {replacementOptions}=await importActualTypeScript(new URL('../src/lib/operations/replacement-options.ts',import.meta.url));
const workers=[{id:'1',name:'Çağrı Şen',code:'MEK-1',active:true,booked:false},{id:'2',name:'İpek',code:'PS-2',active:true,booked:false},{id:'3',name:'İpek',code:'PS-3',active:true,booked:true},{id:'4',name:'İpek',code:'PS-4',active:false,booked:false}];
test('replacement search is Turkish-normalized and excludes booked, inactive and current worker',()=>{assert.deepEqual(replacementOptions(workers,'2','cagri mek').options.map(w=>w.id),['1']);assert.deepEqual(replacementOptions(workers,'1','').options.map(w=>w.id),['2']);});
test('selected available worker survives no matching search without inflating match count',()=>{const r=replacementOptions(workers,'other','unknown','1');assert.equal(r.matchCount,0);assert.equal(r.availableCount,2);assert.deepEqual(r.options.map(w=>w.id),['1']);});
test('selection cannot bypass availability and does not duplicate a matched worker',()=>{assert.deepEqual(replacementOptions(workers,'other','unknown','3').options,[]);assert.deepEqual(replacementOptions(workers,'other','cagri','1').options.map(w=>w.id),['1']);});
