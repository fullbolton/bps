import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {selectCompanyIdentities}=await importActualTypeScript(new URL('../src/lib/supabase/company-identities.ts',import.meta.url));
const {buildCompanyNameMap}=await importActualTypeScript(new URL('../src/lib/import/import-service.ts',import.meta.url));
const client=response=>({from:table=>{assert.equal(table,'companies');return {select:async(fields,options)=>{assert.equal(fields,'id, name');assert.equal(options.count,'exact');return response;}};}});
test('a second matching company beyond the cap prevents a false unique match',async()=>{
 const response={data:[{id:'a',name:'Example'},{id:'b',name:'Other'}],count:3,error:null};
 await assert.rejects(selectCompanyIdentities(client(response)));
 await assert.rejects(buildCompanyNameMap(client(response)));
});
test('complete ambiguous names stay excluded while unique names resolve',async()=>{
 const data=[{id:'a',name:'Example'},{id:'b',name:'Other'},{id:'c',name:' Example '}];
 const map=await buildCompanyNameMap(client({data,count:3,error:null}));
 assert.equal(map.has('Example'),false);assert.equal(map.get('Other'),'b');
});
test('empty is measured, but errors and uncounted lists cannot produce a map',async()=>{
 assert.equal((await buildCompanyNameMap(client({data:[],count:0,error:null}))).size,0);
 for(const response of [{data:[],count:null,error:null},{data:null,count:0,error:null},{data:[],count:0,error:{message:'offline'}}])await assert.rejects(buildCompanyNameMap(client(response)));
});
