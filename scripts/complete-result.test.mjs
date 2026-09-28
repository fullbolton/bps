import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const modules=await Promise.all(['notes','contracts','critical-dates','appointments','workforce-summary','tasks'].map(name=>importActualTypeScript(new URL(`../src/lib/supabase/${name}.ts`,import.meta.url))));
const readers=[modules[0].selectNotesByCompanyId,modules[1].selectAllContracts,modules[1].selectContractsByCompanyId,modules[1].getActiveContractCountsByCompanyIds,modules[2].selectAllCriticalDates,modules[3].selectAllAppointments,modules[3].selectAppointmentsByCompanyId,modules[3].selectAppointmentsByContractId,modules[3].selectAppointmentsByCompanyIds,modules[4].selectAllWorkforceSummaries,modules[4].selectWorkforceSummariesByCompanyIds,modules[5].selectTasksByCompanyId,modules[5].selectAllTasks,modules[5].selectTasksByContractId,modules[5].selectTasksByAppointmentId];
function client(result){let selected=false;const chain={select(_cols,opts){assert.equal(opts.count,'exact');selected=true;return chain;},eq(){return chain;},in(){return chain;},order(){return chain;},then(resolve,reject){assert.ok(selected);return Promise.resolve(result).then(resolve,reject);}};return {from(){return chain;}};}
for(const read of readers)test(`${read.name} rejects clipped, null-count and failed results`,async()=>{
 for(const response of [{data:[{company_id:'a'}],count:2,error:null},{data:[],count:null,error:null},{data:null,count:0,error:null},{data:[],count:0,error:{message:'offline'}}])await assert.rejects(read(client(response),['a']));
 const empty=await read(client({data:[],count:0,error:null}),['a']);assert.equal(Object.keys(empty).length,0);
});
test('active counts retain repeated company IDs in a complete result',async()=>{
 const result=await modules[1].getActiveContractCountsByCompanyIds(client({data:[{company_id:'a'},{company_id:'a'},{company_id:'b'}],count:3,error:null}),['a','b']);
 assert.deepEqual(result,{a:2,b:1});
});

test('empty company selection never fetches a broader workforce or appointment list',async()=>{
 const noRead={from(){throw Error('Unexpected read');}};
 assert.deepEqual(await modules[4].selectWorkforceSummariesByCompanyIds(noRead,[]),[]);
 assert.deepEqual(await modules[3].selectAppointmentsByCompanyIds(noRead,[]),[]);
});
const {countedResult}=await importActualTypeScript(new URL('../src/lib/supabase/complete-result.ts',import.meta.url));
test('dashboard exact totals survive clipped lists while card rows remain unavailable',()=>{
 assert.deepEqual(countedResult({data:[{id:'a'}],count:1500,error:null}),{count:1500,rows:null});
 assert.deepEqual(countedResult({data:null,count:1500,error:null}),{count:1500,rows:null});
 assert.deepEqual(countedResult({data:[],count:0,error:null}),{count:0,rows:[]});
 assert.deepEqual(countedResult({data:[{id:'a'}],count:1,error:null}),{count:1,rows:[{id:'a'}]});
});
test('unavailable or malformed totals cannot become measured zero',()=>{
 for(const count of [null,undefined,'0',-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.deepEqual(countedResult({data:[],count,error:null}),{count:null,rows:null});
 assert.deepEqual(countedResult({data:[{id:'a'}],count:0,error:null}),{count:null,rows:null});
 assert.deepEqual(countedResult({data:[],count:0,error:{message:'offline'}}),{count:null,rows:null});
});
const {hasCompleteCompanyReferences}=await importActualTypeScript(new URL('../src/lib/supabase/company-references.ts',import.meta.url));
test('report joins reject missing source or a missing company anywhere in the list',()=>{
 assert.equal(hasCompleteCompanyReferences(null,new Set()),false);
 assert.equal(hasCompleteCompanyReferences([],null),false);
 assert.equal(hasCompleteCompanyReferences([{company_id:'a'},{company_id:'b'}],new Set(['a'])),false);
});
test('report joins preserve measured empty lists and legitimate display names without text sentinels',()=>{
 const companies=[{id:'a',name:'—'}];
 assert.equal(hasCompleteCompanyReferences([],new Set()),true);
 assert.equal(hasCompleteCompanyReferences([{company_id:'a'},{company_id:'a'}],new Set(companies.map(c=>c.id))),true);
});
