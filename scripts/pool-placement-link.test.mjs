import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {parsePoolPlacement,poolPlacementHref,placementReturnHref}=await importActualTypeScript(new URL('../src/lib/operations/pool-placement-link.ts',import.meta.url));
const id='00000000-0000-4000-8000-000000000020';
const input={sirket:id,firma:id,talep:id,gun:'2026-09-24',meslek:'Aşçı & servis'};
test('request context round trips without dropping day, scope, or encoded job',()=>{
 const c=parsePoolPlacement(input);assert.ok(c);
 const url=new URL(poolPlacementHref(c),'https://bps.test');assert.deepEqual(parsePoolPlacement(Object.fromEntries(url.searchParams)),c);
 const back=new URL(placementReturnHref(c,id),'https://bps.test');assert.equal(back.searchParams.get('personel'),id);assert.equal(back.searchParams.get('gun'),input.gun);assert.equal(back.searchParams.get('sirket'),id);assert.equal(back.hash,'#talep-'+id);
});
test('malformed or duplicate context cannot initialize a placement journey',()=>{
 for(const patch of [{sirket:'bad'},{firma:['a','b']},{talep:'../admin'},{gun:'2026-02-30'},{gun:'1999-12-31'},{meslek:'x'.repeat(81)},{meslek:'a\nb'},{meslek:''}])assert.equal(parsePoolPlacement({...input,...patch}),null);
 assert.equal(new URL(placementReturnHref(parsePoolPlacement(input),'https://evil.test'),'https://bps.test').searchParams.has('personel'),false);
});
