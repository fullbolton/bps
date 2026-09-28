import test from 'node:test';import assert from 'node:assert/strict';import {importActualTypeScript} from './helpers/import-typescript.mjs';
const board=await importActualTypeScript(new URL('../src/lib/management-board.ts',import.meta.url));
const saved=await importActualTypeScript(new URL('../src/lib/talent/saved-searches.ts',import.meta.url));
const people=await importActualTypeScript(new URL('../src/lib/talent/people.ts',import.meta.url));
const avail=await importActualTypeScript(new URL('../src/lib/talent/availability.ts',import.meta.url));
const id='00000000-0000-4000-8000-000000000001';
test('management date follows Istanbul midnight and owner/date filters stay server-side',()=>{
 assert.equal(board.istanbulToday(new Date('2026-09-23T21:05:00Z')),'2026-09-24');
 const calls=[],builder={eq:(...args)=>(calls.push(['eq',...args]),builder),is:(...args)=>(calls.push(['is',...args]),builder),lt:(...args)=>(calls.push(['lt',...args]),builder)};
 board.applyManagementFilters(builder,{owner:'unassigned',period:'overdue',offset:0},'2026-09-24');
 assert.deepEqual(calls,[['is','assigned_to_user_id',null],['lt','due_date','2026-09-24']]);
 for(const patch of [{owner:'invalid'},{offset:1},{offset:-50},{period:'guess'}])assert.throws(()=>board.validateManagementQuery({...board.managementQuery,...patch}));
});
test('saved search stores normalized filter not a page and rejects corrupt/duplicate data',()=>{
 const rows=saved.appendSavedSearch([],' İstanbul ',{...people.initialQuery,offset:50,city:' İstanbul '},id);
 assert.equal(rows[0].query.offset,0);assert.equal(rows[0].query.city,'İstanbul');
 assert.throws(()=>saved.appendSavedSearch(rows,'istanbul',people.initialQuery,'00000000-0000-4000-8000-000000000002'));
 assert.throws(()=>saved.parseSavedSearches(JSON.stringify([...rows,...rows])));
 assert.throws(()=>saved.parseSavedSearches('{broken'));
 assert.throws(()=>saved.parseSavedSearches(JSON.stringify([{...rows[0],query:{...people.initialQuery,ageMin:'90',ageMax:'20'}}])));
});
test('availability rejects impossible dates, inverted and excessive intervals',()=>{
 const input={commandId:id,expectedRevision:0,state:'available',startsOn:'2026-09-23',endsOn:'2026-09-24'};
 assert.deepEqual(avail.validateAvailability(input),input);
 for(const patch of [{startsOn:'2026-02-30'},{endsOn:'2026-09-22'},{endsOn:'2028-09-24'},{expectedRevision:-1},{state:'assumed'}])assert.throws(()=>avail.validateAvailability({...input,...patch}));
});
test('past and superseded availability never becomes current via fallback',()=>{
 const rows=[{state:'unknown',starts_on:'2026-10-01',ends_on:'2026-10-02'},{state:'available',starts_on:'2026-09-01',ends_on:'2026-12-31'}];
 assert.equal(avail.availabilityOn(rows,'2026-09-23'),'unknown');assert.equal(avail.availabilityOn([], '2026-09-23'),'unknown');
 assert.equal(avail.availabilityOn([{state:'available',starts_on:'2026-09-23',ends_on:'2026-09-24'}],'2026-09-24'),'available');
 assert.equal(avail.availabilityOn([{state:'available',starts_on:'2026-09-23',ends_on:'2026-09-24'}],'2026-09-25'),'unknown');
});
