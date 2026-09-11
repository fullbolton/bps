import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/supabase/company-summaries.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {selectPrimaryContactNames:names,selectActiveContractCounts:counts}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function client(load){const calls=[];return {calls,from:table=>{let keys,cursor,filter;const q={select:()=>q,eq:(column,value)=>(filter={column,value},q),in:(column,values)=>(assert.equal(column,'company_id'),keys=[...values],q),order:(column,options)=>(assert.equal(column,'id'),assert.equal(options.ascending,true),q),limit:()=>q,gt:(column,value)=>(assert.equal(column,'id'),cursor=value,q),then:(resolve,reject)=>{const call={table,keys,cursor,filter,index:calls.length};calls.push(call);return Promise.resolve(load(call)).then(resolve,reject);}};return q;}};}
const load=(rows,cap=2)=>p=>({data:rows.filter(r=>p.keys.includes(r.company_id)&&r[p.filter.column]===p.filter.value&&(!p.cursor||r.id>p.cursor)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,cap),error:null});
test('contract counts continue short pages and exclude non-active/unrequested rows',async()=>{
 const rows=Array.from({length:1005},(_,i)=>({id:id(i+10),company_id:id(1),status:'aktif'}));
 rows.push({id:id(2000),company_id:id(1),status:'taslak'},{id:id(2001),company_id:id(2),status:'aktif'});
 const c=client(load(rows,7));assert.deepEqual(await counts(c,[id(1),id(1)]),{[id(1)]:1005});
 assert.ok(c.calls.every(p=>p.keys.length===1&&p.filter.column==='status'&&p.filter.value==='aktif'));assert.equal(c.calls.length,145);
});
test('primary names use bounded batches and preserve every page scope',async()=>{
 const rows=Array.from({length:125},(_,i)=>({id:id(i+1000),company_id:id(i+1),full_name:'Name '+i,is_primary:true}));
 const c=client(load(rows));const result=await names(c,[...rows.map(r=>r.company_id),id(1).toUpperCase()]);assert.equal(Object.keys(result).length,125);
 assert.equal(c.calls.filter(p=>!p.cursor).length,3);assert.ok(c.calls.every(p=>p.keys.length<=60&&p.table==='contacts'&&p.filter.column==='is_primary'&&p.filter.value===true));
 for(const p of c.calls)if(p.cursor)assert.ok(c.calls.some(first=>!first.cursor&&JSON.stringify(first.keys)===JSON.stringify(p.keys)));
});
test('empty scope does not query; invalid scope cannot fall back to global',async()=>{
 const c=client(()=>{throw Error('must not query');});assert.deepEqual(await names(c,[]),{});assert.deepEqual(await counts(c,[]),{});
 for(const value of [undefined,null,[''],['abc'],[undefined]])await assert.rejects(counts(c,value),/invalid scope/);assert.equal(c.calls.length,0);
});
test('later page and later batch failures reject entire maps',async()=>{
 const row={id:id(1000),company_id:id(1),status:'aktif'};
 await assert.rejects(counts(client(p=>p.index===0?{data:[row],error:null}:{data:null,error:{message:'private'}}),[id(1)]),/page failed/);
 const ids=Array.from({length:61},(_,i)=>id(i+1));const c=client(p=>p.keys.includes(id(61))?{data:null,error:{message:'private'}}:load([row])(p));await assert.rejects(counts(c,ids),/page failed/);
});
test('null, repeated IDs, scope leakage, wrong status and duplicate primary are rejected',async()=>{
 const row={id:id(1000),company_id:id(1),status:'aktif'};
 await assert.rejects(counts(client(()=>({data:null,error:null})),[id(1)]),/invalid page/);
 await assert.rejects(counts(client(()=>({data:[row],error:null})),[id(1)]),/did not advance/);
 await assert.rejects(counts(client(()=>({data:[{...row,company_id:id(2)}],error:null})),[id(1)]),/scope mismatch/);
 await assert.rejects(counts(client(()=>({data:[{...row,status:'taslak'}],error:null})),[id(1)]),/invalid contract/);
 const contacts=[{id:id(1000),company_id:id(1),full_name:'A',is_primary:true},{id:id(1001),company_id:id(1),full_name:'B',is_primary:true}];
 await assert.rejects(names(client(load(contacts)),[id(1)]),/multiple primary/);
 await assert.rejects(names(client(()=>({data:[{...contacts[0],is_primary:false}],error:null})),[id(1)]),/invalid contact/);
});
test('input is copied and scans have a terminal bound',async()=>{
 const requested=[id(1)];const c=client(p=>{requested[0]=id(2);return {data:p.cursor?[]:[{id:id(1000),company_id:id(1),status:'aktif'}],error:null};});assert.deepEqual(await counts(c,requested),{[id(1)]:1});assert.ok(c.calls.every(p=>p.keys[0]===id(1)));
 const growing=client(p=>({data:[{id:id(1000+p.index),company_id:id(1),status:'aktif'}],error:null}));await assert.rejects(counts(growing,[id(1)]),/scan limit exceeded/);assert.equal(growing.calls.length,201);
});
