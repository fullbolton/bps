import test from 'node:test';import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {startTrackingHref}=await importActualTypeScript(new URL('../src/lib/operations/start-tracking-link.ts',import.meta.url));
test('tracking link preserves day and safely encodes worker search without enabling urgent filter',()=>{
 const href=startTrackingHref('2026-09-15','  Çağrı & İpek  ');const url=new URL(href,'https://example.test');
 assert.equal(url.pathname,'/talepler/ise-baslama');assert.equal(url.searchParams.get('gun'),'2026-09-15');assert.equal(url.searchParams.get('ara'),'Çağrı & İpek');assert.equal(url.searchParams.has('aksiyon'),false);
});
test('missing name and invalid day cannot produce an unrelated tracking destination',()=>{
 assert.equal(startTrackingHref('2026-02-30','Ali'),null);assert.equal(startTrackingHref('2026-09-15',' '),null);assert.equal(new URL(startTrackingHref('2026-09-15','a'.repeat(250)),'https://example.test').searchParams.get('ara').length,200);
});
const {startBoardHref,dailyPlanReturnHref}=await importActualTypeScript(new URL('../src/lib/operations/start-tracking-link.ts',import.meta.url));
test('tracking preserves return company separately from the all-company query and chosen return day',()=>{
 const company='00000000-0000-4000-8000-000000000020';
 const tracking=new URL(startTrackingHref('2026-09-24','Çağrı & İpek',company),'https://example.test');
 assert.equal(tracking.searchParams.get('donusFirma'),company);
 assert.equal(tracking.searchParams.has('firma'),false);
 const back=new URL(dailyPlanReturnHref('2026-09-25',tracking.searchParams.get('donusFirma')),'https://example.test');
 assert.equal(back.searchParams.get('firma'),company);assert.equal(back.searchParams.get('gun'),'2026-09-25');
 assert.equal(new URL(startBoardHref('2026-09-24',company),'https://example.test').searchParams.has('ara'),false);
});
test('return navigation rejects malformed company and impossible dates without accepting arbitrary URLs',()=>{
 assert.equal(startBoardHref('2026-02-30','bad'),null);
 assert.equal(dailyPlanReturnHref('2026-02-30','bad'),'/talepler/gunluk');
 for(const value of ['https://evil.test','../admin','x&firma=other','']){
  assert.equal(new URL(dailyPlanReturnHref('2026-09-24',value),'https://example.test').searchParams.has('firma'),false);
  assert.equal(new URL(startBoardHref('2026-09-24',value),'https://example.test').searchParams.has('donusFirma'),false);
 }
});
