import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {entries,render,migrationUrl} from './talent-module-gates.mjs';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {talentError}=await importActualTypeScript(new URL('../src/lib/services/talent.ts',import.meta.url));
test('migration is exactly generated from 39 unique reviewed signatures and source bodies',()=>{
 assert.equal(entries.length,39);assert.equal(new Set(entries.map(e=>e.signature)).size,39);assert.equal(readFileSync(migrationUrl,'utf8'),render());
});
test('write guards come before original business statements; only worker preparation needs staffing',()=>{
 for(const e of entries){assert.ok(e.guard.includes(`workspace_require_module_${e.mode}_v1`));assert.equal(e.guard.includes("'staffing'"),e.name==='talent_prepare_worker');}
});
test('known module denials are clear, while transport uncertainty remains distinct',()=>{
 assert.match(talentError({code:'BM001',message:'MODULE_DISABLED'}),/modül.*kapalı/);
 assert.match(talentError({code:'55000',message:'MODULE_CONFIG_MISSING'}),/ayarları doğrulanamadı/);
 assert.match(talentError(new Error('fetch failed')),/İşlem sonucu doğrulanamadı/);
});

test('assignment projection migration is generated against the already gated body',async()=>{
 const p=await import('./talent-assignment-projection.mjs');
 assert.equal(readFileSync(p.migrationUrl,'utf8'),p.render());
 const entry=entries.find(e=>e.name==='talent_person_detail');
 assert.equal(p.previous,entry.body.replace(entry.anchor,()=>entry.anchor+entry.guard));
 assert.ok(p.body.includes(entry.guard));
});

test('conversation module patch is generated against prior guarded bodies',async()=>{
 const p=await import('./talent-conversation-modules.mjs');assert.equal(readFileSync(p.migrationUrl,'utf8'),p.render());
 for(const patch of p.patches){const entry=entries.find(e=>e.name===patch.name);assert.equal(patch.previous,entry.body.replace(entry.anchor,()=>entry.anchor+entry.guard));assert.ok(patch.body.includes(entry.guard));}
});
