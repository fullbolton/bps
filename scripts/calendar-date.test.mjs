import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {computeRemainingDays,isIsoDate}=await importActualTypeScript(new URL('../src/lib/calendar-date.ts',import.meta.url));
test('contract days follow Istanbul midnight and preserve today/expired semantics',()=>{
 assert.equal(computeRemainingDays('2026-09-15',new Date('2026-09-14T20:59:59Z')),1);
 assert.equal(computeRemainingDays('2026-09-15',new Date('2026-09-14T21:00:00Z')),0);
 assert.equal(computeRemainingDays('2026-09-14',new Date('2026-09-14T21:00:00Z')),-1);
 assert.equal(computeRemainingDays('2027-01-01',new Date('2026-12-31T21:00:00Z')),0);
 assert.equal(computeRemainingDays('2024-03-01',new Date('2024-02-28T21:00:00Z')),1);
});
test('missing, malformed and impossible contract dates never turn into a plausible remaining-day count',()=>{
 for(const value of [null,undefined,'','2026-02-30','2026-04-31','15.09.2026','2026-09-15garbage','2026-09-15T00:00:00Z']){
  assert.equal(computeRemainingDays(value,new Date('2026-09-15T09:00:00Z')),null);assert.equal(isIsoDate(value),false);
 }
 assert.equal(computeRemainingDays('2026-09-15',new Date('invalid')),null);
 assert.equal(isIsoDate('2024-02-29'),true);
});
