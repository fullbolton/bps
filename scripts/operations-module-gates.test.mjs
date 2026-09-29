import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entries,render,migrationUrl} from './operations-module-gates.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
test('40 unique operation signatures generate the committed migration exactly',()=>{
 assert.equal(entries.length,40);assert.equal(new Set(entries.map(e=>e.signature)).size,40);assert.equal(readFileSync(migrationUrl,'utf8'),render());
});
test('schedule readers taking profile locks use write barrier; operations never require talent',()=>{
 for(const e of entries){assert.ok(e.guard.includes("ARRAY['staffing']"));assert.ok(!e.guard.includes("'talent'"));}
 for(const name of ['ops_schedule_list','ops_schedule_preview','ops_schedule_save','ops_schedule_generate'])assert.equal(entries.find(e=>e.name===name).mode,'write');
});
for(const [path,fn] of [['services/daily-operations','pilotError'],['operations/fixed-roster','fixedRosterError'],['operations/work-approval','workError'],['operations/recurring-schedules','scheduleError'],['operations/start-board','startError']])test(`${fn} distinguishes module rejection from transport uncertainty`,async()=>{
 const mod=await importActualTypeScript(new URL('../src/lib/'+path+'.ts',import.meta.url));
 assert.match(mod[fn]({code:'BM001',message:'MODULE_DISABLED'}),/modül.*kapalı/);
 assert.match(mod[fn]({code:'55000',message:'MODULE_CONFIG_MISSING'}),/ayarları doğrulanamadı/);
 assert.doesNotMatch(mod[fn](new Error('fetch failed')),/modül.*kapalı/);
});
