import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {listViewKey,readListView}=await importActualTypeScript(new URL('../src/lib/list-view-state.ts',import.meta.url));
const defaults={durum:'',firma:''};
test('valid search and known filter values survive serialization',()=>{assert.deepEqual(readListView(JSON.stringify({search:'İstanbul',filters:{durum:'aktif',firma:'A'}}),defaults),{search:'İstanbul',filters:{durum:'aktif',firma:'A'}});});
test('malformed, oversized and wrongly typed preferences recover to defaults',()=>{for(const raw of [null,'{','null','[]','x'.repeat(9000),JSON.stringify({search:42,filters:{durum:{},firma:5}})])assert.deepEqual(readListView(raw,defaults),{search:'',filters:defaults});});
test('unknown keys and overlong fields cannot enter the filter state',()=>{assert.deepEqual(readListView(JSON.stringify({search:'x'.repeat(513),filters:{durum:'x'.repeat(513),firma:'A',tenant:'foreign',__proto__:'bad'}}),defaults),{search:'',filters:{durum:'',firma:'A'}});});
test('keys separate list, account, tenant and role without separator ambiguity',()=>{
 const scopes=[['a','t1','yonetici'],['b','t1','yonetici'],['a','t2','yonetici'],['a','t1','operasyon']].map(JSON.stringify);
 const keys=['firmalar','sozlesmeler'].flatMap(list=>scopes.map(scope=>listViewKey(list,scope)));assert.equal(new Set(keys).size,8);assert.notEqual(listViewKey('a:b','c'),listViewKey('a','b:c'));
});
