import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entries,render,migrationUrl} from './operations-module-gates.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
test('39 unique operation signatures generate the committed migration exactly',()=>{
 assert.equal(entries.length,39);assert.equal(new Set(entries.map(e=>e.signature)).size,39);assert.equal(readFileSync(migrationUrl,'utf8'),render());
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

test('all nine module baselines match the measured production hotfix hashes',async()=>{
 const {entries:talent}=await import('./talent-module-gates.mjs');const {entries:reporting}=await import('./reporting-module-gates.mjs');
 const measured=JSON.parse(readFileSync(new URL('../qa/security-correctness-release-20261005/after.json',import.meta.url),'utf8'));
 const expected=new Map(measured.functions.map(e=>[e.signature,e.hash]));const changed=[...entries,...talent,...reporting].filter(e=>e.preHotfixBody);
 assert.equal(changed.length,9);for(const e of changed)assert.equal(e.hash,expected.get(e.signature),e.signature);
});
test('released hotfix replay rejects an unreviewed predecessor',async()=>{
 const {withReleasedHotfix}=await import('./helpers/released-hotfix-history.mjs');const e=entries.find(e=>e.preHotfixBody);
 assert.throws(()=>withReleasedHotfix({...e,body:e.preHotfixBody+'\n-- unknown change'}),/baseline drift/);
});
test('all pending module versions follow the applied security release',()=>{
 const mapping=JSON.parse(readFileSync(new URL('../qa/module-hotfix-first-20261005/migration-renumbering.json',import.meta.url),'utf8'));
 const names=Object.values(mapping);assert.equal(names.length,28);assert.equal(new Set(names.map(n=>n.slice(0,14))).size,28);
 for(const n of names){assert.ok(n.slice(0,14)>'20261004001400');assert.ok(readFileSync(new URL('../supabase/migrations/'+n,import.meta.url),'utf8').length>0);}
});
