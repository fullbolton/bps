import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {completePages}=await importActualTypeScript(new URL('../src/lib/supabase/complete-pages.ts',import.meta.url));
const rows=Array.from({length:1001},(_,i)=>({id:String(i),company_id:'c'}));
test('1001 rows require three bounded requests; no clipping or redundant empty request',async()=>{
 const calls=[]; const got=await completePages((from,to,signal)=>{calls.push([from,to]);assert.ok(signal instanceof AbortSignal);return Promise.resolve({data:rows.slice(from,to+1),count:rows.length,error:null});},'Test');
 assert.deepEqual(got,rows);assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
});
test('empty and exact page boundary terminate without an extra read',async()=>{
 for(const n of [0,500,1000]){let calls=0;await completePages((from,to)=>{calls++;return Promise.resolve({data:rows.slice(0,n).slice(from,to+1),count:n,error:null});},'Test');assert.equal(calls,Math.max(1,n/500));}
});
test('second-page failures never return the first page as a complete list',async()=>{
 for(const second of [
 {data:rows.slice(500,999),count:1001,error:null},
 {data:rows.slice(500,1000),count:1002,error:null},
 {data:rows.slice(0,500),count:1001,error:null},
 {data:null,count:1001,error:{message:'private detail'}},
 {data:[],count:null,error:null},
 ]){let calls=0;await assert.rejects(completePages(()=>Promise.resolve(++calls===1?{data:rows.slice(0,500),count:1001,error:null}:second),'Test'));assert.equal(calls,2);}
});
test('invalid identities, malformed totals and over-budget lists fail on first request',async()=>{
 for(const result of [
 {data:[{id:''}],count:1,error:null},
 {data:[{id:'a'},{id:'a'}],count:2,error:null},
 {data:[],count:10001,error:null},
 {data:[],count:-1,error:null},
 {data:[],count:0.5,error:null},
 {data:null,count:0,error:null},
 ]){let calls=0;await assert.rejects(completePages(()=>{calls++;return Promise.resolve(result);},'Test'));assert.equal(calls,1);}
});
const tasks=await importActualTypeScript(new URL('../src/lib/supabase/tasks.ts',import.meta.url));
const appointments=await importActualTypeScript(new URL('../src/lib/supabase/appointments.ts',import.meta.url));
const contracts=await importActualTypeScript(new URL('../src/lib/supabase/contracts.ts',import.meta.url));
const notes=await importActualTypeScript(new URL('../src/lib/supabase/notes.ts',import.meta.url));
const critical=await importActualTypeScript(new URL('../src/lib/supabase/critical-dates.ts',import.meta.url));
const workforce=await importActualTypeScript(new URL('../src/lib/supabase/workforce-summary.ts',import.meta.url));
for(const [read,table,filter,arg] of [
 [critical.selectAllCriticalDates,'critical_dates',null,null],
 [workforce.selectAllWorkforceSummaries,'workforce_summary',null,null],
 [workforce.selectWorkforceSummariesByCompanyIds,'workforce_summary','company_id',['c']],
 [tasks.selectAllTasks,'tasks',null,null],
 [tasks.selectTasksByCompanyId,'tasks','company_id','c'],
 [tasks.selectTasksByContractId,'tasks','contract_id','contract'],
 [tasks.selectTasksByAppointmentId,'tasks','appointment_id','appointment'],
 [appointments.selectAllAppointments,'appointments',null,null],
 [appointments.selectAppointmentsByCompanyId,'appointments','company_id','c'],
 [appointments.selectAppointmentsByContractId,'appointments','contract_id','contract'],
 [appointments.selectAppointmentsByCompanyIds,'appointments','company_id',['c']],
 [contracts.selectAllContracts,'contracts',null,null],
 [contracts.selectContractsByCompanyId,'contracts','company_id','c'],
 [notes.selectNotesByCompanyId,'notes','company_id','c'],
 [contracts.getActiveContractCountsByCompanyIds,'contracts','company_id',['c']],
])test(`${read.name} retains scope, exact count and unique ordering on all pages`,async()=>{
 const requests=[];const client={from(t){assert.equal(t,table);const request={filters:[],orders:[]};requests.push(request);let range;
 const chain={select(cols,opts){assert.equal(opts.count,'exact');return chain;},eq(k,v){request.filters.push([k,v]);return chain;},in(k,v){request.filters.push([k,v]);return chain;},order(k){request.orders.push(k);return chain;},range(f,t){range=[f,t];return chain;},abortSignal(signal){assert.ok(signal instanceof AbortSignal);assert.ok(range);return Promise.resolve({data:rows.slice(range[0],range[1]+1),count:rows.length,error:null});}};return chain;}};
 const got=await read(client,arg);assert.equal(requests.length,3);
 for(const request of requests){assert.equal(request.orders.at(-1),'id');if(filter)assert.ok(request.filters.some(([k,v])=>k===filter&&JSON.stringify(v)===JSON.stringify(arg)));}
 if(read===contracts.getActiveContractCountsByCompanyIds){assert.deepEqual(got,{c:1001});for(const r of requests)assert.ok(r.filters.some(([k,v])=>k==='status'&&v==='aktif'));}else assert.deepEqual(got,rows);
});

test('real Supabase query builder sends bounded offsets, stable order and exact count',async()=>{
 const {createClient}=await import('@supabase/supabase-js');const requests=[];
 const client=createClient('https://fixture.invalid','test-key',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
  const u=new URL(typeof input==='string'?input:input.url??input.toString());requests.push(u);
  assert.equal(u.pathname,'/rest/v1/tasks');assert.equal(u.searchParams.get('company_id'),'eq.c');
  assert.equal(u.searchParams.get('order'),'created_at.desc,id.asc');assert.equal(u.searchParams.get('limit'),'500');
  const start=Number(u.searchParams.get('offset'));const data=rows.slice(start,start+500);
  return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json','content-range':`${start}-${start+data.length-1}/${rows.length}`}});
 }}});
 assert.deepEqual(await tasks.selectTasksByCompanyId(client,'c'),rows);
 assert.deepEqual(requests.map(u=>u.searchParams.get('offset')),['0','500','1000']);
});
test('deadline expiry stops before the next page',async(t)=>{
 const controller=new AbortController();t.mock.method(AbortSignal,'timeout',()=>controller.signal);let calls=0;
 await assert.rejects(completePages(()=>{calls++;controller.abort();return Promise.resolve({data:rows.slice(0,500),count:1001,error:null});},'Test'),{name:'AbortError'});
 assert.equal(calls,1);
});
