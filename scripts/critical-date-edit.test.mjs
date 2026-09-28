import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {updateCriticalDateRecord}=await importActualTypeScript(new URL('../src/lib/services/critical-dates.ts',import.meta.url));
function client(){let patch;const row={id:'date-a',responsible:'Eski sorumlu',note:'Eski not'};const q={from(){return q;},select(){return q;},eq(){return q;},maybeSingle:async()=>({data:{...row,...patch},error:null}),update(value){patch=value;return q;},single:async()=>({data:{...row,...patch},error:null})};return {q,getPatch:()=>patch};}
test('explicit empty optional critical-date fields clear stored content',async()=>{
 const c=client();const result=await updateCriticalDateRecord(c.q,'date-a',{expectedUpdatedAt:'2026-09-15T01:00:00.123456+00:00',responsible:' ',note:''});
 assert.equal(result.responsible,null);assert.equal(result.note,null);
});
test('omitted optional critical-date fields remain untouched',async()=>{
 const c=client();const result=await updateCriticalDateRecord(c.q,'date-a',{expectedUpdatedAt:'2026-09-15T01:00:00.123456+00:00',title:'Yeni başlık'});
 assert.equal(result.responsible,'Eski sorumlu');assert.equal(result.note,'Eski not');
 assert.equal(Object.hasOwn(c.getPatch(),'responsible'),false);assert.equal(Object.hasOwn(c.getPatch(),'note'),false);
});
test('nonempty optional critical-date fields are trimmed',async()=>{
 const c=client();const result=await updateCriticalDateRecord(c.q,'date-a',{expectedUpdatedAt:'2026-09-15T01:00:00.123456+00:00',responsible:' Yeni sorumlu ',note:' Yeni not '});
 assert.equal(result.responsible,'Yeni sorumlu');assert.equal(result.note,'Yeni not');
});

const {updateCriticalDate}=await importActualTypeScript(new URL('../src/lib/supabase/critical-dates.ts',import.meta.url));
test('critical-date CAS preserves full database timestamp and rejects a losing edit',async()=>{
 const calls=[];const q={from(){return q;},update(){return q;},eq(...args){calls.push(args);return q;},select(){return q;},maybeSingle:async()=>({data:null,error:null})};
 const expected='2026-09-15T01:00:00.123456+00:00';
 await assert.rejects(updateCriticalDate(q,'date-a',{note:'Draft'},expected),e=>e.name==='CriticalDateConflictError');
 assert.deepEqual(calls,[['id','date-a'],['updated_at',expected]]);
});
test('missing or malformed snapshot cannot update a critical date',async()=>{
 const q={from(){throw Error('Unexpected query');}};
 for(const expected of [null,undefined,'','invalid','2026-09-15'])await assert.rejects(updateCriticalDate(q,'date-a',{},expected),/Kayıt sürümü/);
});
