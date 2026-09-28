import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {selectCompanyFinancial}=await importActualTypeScript(new URL('../src/lib/supabase/company-financial.ts',import.meta.url));
function client(response, expectedId='company-a') {
 return {from(table){assert.equal(table,'financial_summaries');return {select(fields){assert.equal(fields,'open_receivable, unbilled_amount, is_overdue, last_source');return {eq(column,id){assert.equal(column,'company_id');assert.equal(id,expectedId);return {maybeSingle:async()=>response};}};}};}};
}
test('financial reader binds the resolved company id and preserves real zero',async()=>{
 const row={open_receivable:'0',unbilled_amount:'15',is_overdue:false,last_source:'mizan'};
 assert.deepEqual(await selectCompanyFinancial(client({data:row,error:null}),'company-a'),row);
});
test('only successful explicit null means no financial record',async()=>{
 assert.equal(await selectCompanyFinancial(client({data:null,error:null}),'company-a'),null);
 for(const response of [{data:null,error:{message:'offline'}},{data:undefined,error:null},{data:{open_receivable:'100'},error:{message:'denied'}}])
  await assert.rejects(selectCompanyFinancial(client(response),'company-a'));
});
test('missing identity never starts a financial query',async()=>{
 await assert.rejects(selectCompanyFinancial({from(){assert.fail('must not query');}},''));
});
test('legacy source absence stays unknown',async()=>{
 const result=await selectCompanyFinancial(client({data:{open_receivable:null,unbilled_amount:null,is_overdue:null,last_source:'legacy'},error:null}),'company-a');
 assert.deepEqual(result,{open_receivable:null,unbilled_amount:null,is_overdue:false,last_source:null});
});
