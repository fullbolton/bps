import test from 'node:test';
import assert from 'node:assert/strict';
import { importActualTypeScript } from './helpers/import-typescript.mjs';
const { selectFinancialOverview } = await importActualTypeScript(new URL('../src/lib/supabase/financial-overview.ts', import.meta.url));
const ok = data => ({data, count:Array.isArray(data)?data.length:null, error:null});
const rows = [{company_id:'a',open_receivable:'0',unbilled_amount:'150',is_overdue:false}];
const companies = [{id:'a',name:'—',status:'aktif'}];
function client(responses) {
 let call=0;
 return {from(table){
  const index=call++;
  assert.equal(table,index===2?'companies':'financial_summaries');
  const query={select(fields,options){if(index>0)assert.equal(options.count,'exact');return query;},is(){return query;},not(){return query;},maybeSingle(){return query;},then(resolve,reject){return Promise.resolve(responses[index]).then(resolve,reject);}};
  return query;
 }};
}
test('complete financial view preserves zero amounts and legitimate placeholder-like company names',async()=>{
 const result=await selectFinancialOverview(client([ok(null),ok(rows),ok(companies)]));
 assert.equal(result.portfolio,null);assert.equal(result.aktifFirma,1);
 assert.equal(result.perCompany[0].firmaAdi,'—');assert.equal(result.perCompany[0].acikAlacak,'0');
});
test('either truncated list rejects the entire view',async()=>{
 for(const index of [1,2]){
  const responses=[ok(null),ok(rows),ok(companies)];responses[index].count=2;
  await assert.rejects(selectFinancialOverview(client(responses)));
 }
});
test('unresolved or duplicate financial company identities are not silently omitted',async()=>{
 for(const data of [[{...rows[0],company_id:'missing'}],[...rows,...rows],[{...rows[0],company_id:null}]])
  await assert.rejects(selectFinancialOverview(client([ok(null),ok(data),ok(companies)])));
});
test('every read error and unknown list completeness fails, while measured empty is valid',async()=>{
 for(const index of [0,1,2]){
  const responses=[ok(null),ok(rows),ok(companies)];responses[index].error={message:'offline'};
  await assert.rejects(selectFinancialOverview(client(responses)));
 }
 for(const response of [{data:null,count:0,error:null},{data:[],count:null,error:null}])
  await assert.rejects(selectFinancialOverview(client([ok(null),response,ok(companies)])));
 assert.deepEqual(await selectFinancialOverview(client([ok(null),ok([]),ok([])])),{portfolio:null,perCompany:[],aktifFirma:0});
});
