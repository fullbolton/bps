import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/supabase/documents.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const {selectAllDocuments,selectDocumentsByCompanyId,selectDocumentsByCompanyIds}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const company=n=>'abcdef00-1111-4111-8111-'+String(n).padStart(12,'0');
const row=(i,date='2026-09-01')=>({id:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),updated_at:date});
function client(load){let calls=0;return {from:()=>{let cursor=null,limit,companies;const q={select:()=>q,eq:(_key,id)=>(companies=[id],q),in:(_key,ids)=>(companies=[...ids],q),order:()=>q,limit:n=>(limit=n,q),gt:(_key,id)=>(cursor=id,q),then:(resolve,reject)=>Promise.resolve(load({cursor,limit,companies,call:++calls})).then(resolve,reject)};return q;},get calls(){return calls;}};}
test('reads past short capped pages until empty and returns newest first with deterministic ties',async()=>{const rows=[row(1,'2020-01-01'),row(2),row(3),row(4,'2027-01-01'),row(5)];const c=client(({cursor,limit})=>({data:rows.filter(r=>!cursor||r.id>cursor).slice(0,Math.min(limit,2)),error:null}));assert.deepEqual((await selectAllDocuments(c)).map(r=>r.id),[4,2,3,5,1].map(i=>row(i).id));assert.equal(c.calls,4);});
test('empty visible dataset is a complete empty result',async()=>assert.deepEqual(await selectAllDocuments(client(()=>({data:[],error:null}))),[]));
test('a later-page error rejects instead of exposing the first page',async()=>{const c=client(({call})=>call===1?{data:[row(1)],error:null}:{data:null,error:{message:'private backend detail'}});await assert.rejects(selectAllDocuments(c),/page failed/);assert.equal(c.calls,2);});
test('null success, repeated cursor and unordered pages fail closed',async()=>{await assert.rejects(selectAllDocuments(client(()=>({data:null,error:null}))),/invalid page/);await assert.rejects(selectAllDocuments(client(()=>({data:[row(1)],error:null}))),/did not advance/);await assert.rejects(selectAllDocuments(client(()=>({data:[row(2),row(1)],error:null}))),/did not advance/);});
test('bounded scan rejects continuous growth instead of returning partial rows',async()=>{const c=client(({call})=>({data:[row(call)],error:null}));await assert.rejects(selectAllDocuments(c),/scan limit exceeded/);assert.equal(c.calls,201);});

test('single company scope is present on every page and unrelated rows are excluded',async()=>{const rows=[{...row(1),company_id:company(1)},{...row(2),company_id:company(2)},{...row(3),company_id:company(1)}];const c=client(({cursor,companies})=>{assert.deepEqual(companies,[company(1)]);return {data:rows.filter(r=>companies.includes(r.company_id)&&(!cursor||r.id>cursor)).slice(0,1),error:null};});assert.deepEqual((await selectDocumentsByCompanyId(c,company(1))).map(r=>r.id),[row(1).id,row(3).id]);assert.equal(c.calls,3);});
test('batch scope is deduplicated and copied; caller mutation cannot widen subsequent pages',async()=>{const ids=[company(1),company(2),company(1)];const rows=[{...row(1),company_id:company(1)},{...row(2),company_id:company(2)},{...row(3),company_id:company(3)}];const c=client(({cursor,companies})=>{assert.deepEqual(companies,[company(1),company(2)]);ids.push(company(3));return {data:rows.filter(r=>companies.includes(r.company_id)&&(!cursor||r.id>cursor)).slice(0,1),error:null};});assert.equal((await selectDocumentsByCompanyIds(c,ids)).length,2);assert.equal(c.calls,3);});
test('empty batch does no query; out-of-scope response fails closed',async()=>{const empty=client(()=>{throw Error('Unexpected unscoped query');});assert.deepEqual(await selectDocumentsByCompanyIds(empty,[]),[]);assert.equal(empty.calls,0);await assert.rejects(selectDocumentsByCompanyId(client(()=>({data:[{...row(1),company_id:company(2)}],error:null})),company(1)),/scope mismatch/);});

test('invalid or missing scoped arguments never fall back to a global scan',async()=>{const c=client(()=>{throw Error('Unexpected query');});for(const ids of [undefined,null,company(1),[undefined],[''],['not-a-uuid'],new Array(1)])await assert.rejects(selectDocumentsByCompanyIds(c,ids),/scope invalid/);await assert.rejects(selectDocumentsByCompanyId(c,undefined),/scope invalid/);assert.equal(c.calls,0);});

test('many company scopes are bounded, paginated, deduplicated and globally sorted',async()=>{
 const ids=Array.from({length:125},(_,i)=>company(i+1));
 const rows=ids.map((company_id,i)=>({...row(i+1,i===124?'2050-01-01':i===0?'2000-01-01':'2026-09-01'),company_id}));
 const seen=[];const c=client(({cursor,companies})=>{seen.push({cursor,companies});return {data:rows.filter(r=>companies.includes(r.company_id)&&(!cursor||r.id>cursor)).slice(0,7),error:null};});
 const result=await selectDocumentsByCompanyIds(c,[...ids,ids[0].toUpperCase()]);assert.equal(result.length,125);assert.equal(result[0].id,row(125).id);assert.equal(result.at(-1).id,row(1).id);assert.ok(seen.every(p=>p.companies.length<=60));assert.equal(seen.filter(p=>!p.cursor).length,3);assert.deepEqual(result.slice(1,-1).map(r=>r.id),rows.slice(1,-1).map(r=>r.id));
});
test('a later company batch failure rejects all previously read documents',async()=>{
 const ids=Array.from({length:61},(_,i)=>company(i+1));const c=client(({cursor,companies})=>companies.includes(ids[60])?{data:null,error:{message:'private'}}:{data:cursor?[]:[{...row(1),company_id:ids[0]}],error:null});await assert.rejects(selectDocumentsByCompanyIds(c,ids),/page failed/);assert.equal(c.calls,3);
});
test('a document that moves into a later company batch is rejected rather than double-counted',async()=>{
 const ids=Array.from({length:61},(_,i)=>company(i+1));const c=client(({cursor,companies})=>({data:cursor?[]:[{...row(1),company_id:companies[0]}],error:null}));await assert.rejects(selectDocumentsByCompanyIds(c,ids),/did not advance/);
});
