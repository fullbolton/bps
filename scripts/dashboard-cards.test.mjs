import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const api=await importActualTypeScript(new URL('../src/lib/supabase/dashboard-cards.ts',import.meta.url));
function clientFor(rows,count=rows.length,inspect=()=>{}) {
 return createClient('https://fixture.invalid','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input.url??input.toString());inspect(url,options);
 return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json','content-range':`0-${Math.max(0,rows.length-1)}/${count}`}});
 }}});
}
test('contracts filter in SQL before five-row cap; no full-record transfer',async()=>{
 const rows=Array.from({length:5},(_,i)=>({id:String(i),name:'Contract',company_id:'c',status:'aktif',end_date:'2026-09-28'}));
 const got=await api.selectDashboardContracts(clientFor(rows,9000,u=>{
 assert.equal(u.pathname,'/rest/v1/contracts');assert.equal(u.searchParams.get('status'),'eq.aktif');assert.equal(u.searchParams.get('end_date'),'gte.2026-09-28');assert.equal(u.searchParams.get('limit'),'5');assert.equal(u.searchParams.get('order'),'end_date.asc,id.asc');assert.equal(u.searchParams.get('select'),'id,name,company_id,status,end_date');
 }),'2026-09-28');assert.deepEqual(got,rows);
});
test('documents include missing files and undated manual states before limiting; derive expiry now',async()=>{
 const rows=[{id:'a',name:'Doc',company_id:'c',status:'tam',storage_path:'file.pdf',validity_date:'2026-09-27'},{id:'b',name:'Missing',company_id:'c',status:'tam',storage_path:null,validity_date:'2027-01-01'}];
 const got=await api.selectDashboardDocuments(clientFor(rows,2,u=>{
 assert.equal(u.searchParams.get('or'),'(status.eq.eksik,storage_path.is.null,storage_path.eq."",validity_date.lte.2026-10-28,and(validity_date.is.null,status.neq.tam))');
 assert.equal(u.searchParams.get('limit'),'5');assert.equal(u.searchParams.get('order'),'updated_at.desc,id.asc');assert.ok(!u.searchParams.get('select').includes('*'));
 }),'2026-09-28');assert.deepEqual(got.map(x=>x.status),['suresi_doldu','eksik']);
});
test('critical dates include overdue and exactly thirty days; bounded stable order',async()=>{
 await api.selectDashboardDeadlines(clientFor([],0,u=>{assert.equal(u.searchParams.get('deadline_date'),'lte.2026-10-28');assert.equal(u.searchParams.get('limit'),'4');assert.equal(u.searchParams.get('order'),'deadline_date.asc,id.asc');}),'2026-09-28');
 assert.equal(api.dashboardRemainingDays('2026-09-27','2026-09-28'),-1);
 assert.equal(api.dashboardRemainingDays('2026-10-28','2026-09-28'),30);
 assert.equal(api.dashboardDayWindow('2028-02-01').until,'2028-03-02');
 assert.throws(()=>api.dashboardDayWindow('2026-02-30'));
});
test('smaller server cap, missing counts, duplicate rows and transport errors do not masquerade as complete cards',async()=>{
 for(const [rows,count] of [[[{id:'a'}],6],[[{id:'a'},{id:'a'}],2],[[], '*']])await assert.rejects(api.selectDashboardContracts(clientFor(rows,count),'2026-09-28'));
 const client=createClient('https://fixture.invalid','test-key',{auth:{persistSession:false},global:{fetch:async()=>new Response('{}',{status:500})}});
 await assert.rejects(api.selectDashboardContracts(client,'2026-09-28'));
});
test('company names resolve only referenced IDs in batches; no task count tied to directory cap',async()=>{
 const ids=Array.from({length:76},(_,i)=>`c${i}`),requests=[];
 const client=createClient('https://fixture.invalid','test-key',{auth:{persistSession:false},global:{fetch:async input=>{
 const u=new URL(input.toString());requests.push(u);assert.equal(u.searchParams.get('select'),'id,name');
 const keys=u.searchParams.get('id').slice(4,-1).split(',');const rows=keys.map(id=>({id,name:id}));
 return new Response(JSON.stringify(rows),{status:200,headers:{'content-type':'application/json','content-range':`0-${rows.length-1}/${rows.length}`}});
 }}});
 assert.equal((await api.selectDashboardCompanyNames(client,[...ids,'c0'])).size,76);assert.equal(requests.length,2);
 assert.deepEqual(await api.selectDashboardCompanyNames(client,[]),new Map());assert.equal(requests.length,2);
});
