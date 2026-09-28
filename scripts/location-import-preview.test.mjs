import test from 'node:test';
import assert from 'node:assert/strict';
import {importActualTypeScript} from './helpers/import-typescript.mjs';
const {previewLocationImport}=await importActualTypeScript(new URL('../src/lib/operations/location-import-preview.ts',import.meta.url));
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,company=id(999);
const record=(n,patch={})=>({id:id(n),name:'Şube '+n,city:'İstanbul',code:String(n),active:true,workerKind:null,revision:0,...patch});
const csv=(code,name='Yeni')=>({code,name,city:'İstanbul'});
const read=records=>async q=>({...q,total:records.length,generatedAt:'2026-09-13T10:00:00Z',rows:records.slice(q.offset,q.offset+50)});
test('distinguishes new, unchanged, changed and inactive without rewriting input',async()=>{
 const input=[csv('01'),csv('1','Şube 1'),csv('2'),csv('3','Şube 3')];
 const result=await previewLocationImport(company,input,read([record(1),record(2),record(3,{active:false})]));
 assert.deepEqual(result.rows.map(r=>r.status),['new','same','changed','inactive']);
 assert.equal(result.newCount,1);assert.equal(result.sameCount,1);assert.equal(result.blockedCount,2);
 assert.equal(result.rows[2].previous.name,'Şube 2');assert.equal(input[2].name,'Yeni');
});
test('reads beyond first page and includes inactive rows',async()=>{
 const result=await previewLocationImport(company,[csv('51','Şube 51')],read(Array.from({length:51},(_,i)=>record(i+1,{active:i!==50}))));
 assert.equal(result.rows[0].status,'inactive');
});
test('null codes do not match by name; leading zeros and case remain distinct',async()=>{
 const result=await previewLocationImport(company,[csv('01'),csv('a')],read([record(1),record(2,{code:'A'}),record(3,{code:null,name:'Yeni'})]));
 assert.equal(result.newCount,2);
});
test('read failures and malformed pages never become new records',async()=>{
 await assert.rejects(previewLocationImport(company,[csv('1')],async()=>{throw Error('read failed');}));
 await assert.rejects(previewLocationImport(company,[csv('1')],async q=>({...q,total:1,rows:[],generatedAt:'2026-09-13T10:00:00Z'})));
});
test('changing totals and duplicated records across pages fail closed',async()=>{
 const records=Array.from({length:51},(_,i)=>record(i+1));
 await assert.rejects(previewLocationImport(company,[csv('1')],async q=>({...await read(records)(q),total:q.offset?52:51,rows:q.offset?[record(51),record(52)]:records.slice(0,50)})));
 await assert.rejects(previewLocationImport(company,[csv('1')],async q=>({...await read(records)(q),rows:q.offset?[record(1)]:records.slice(0,50)})));
});
test('oversized directory stops after first page; no partial preview',async()=>{
 let calls=0;
 await assert.rejects(previewLocationImport(company,[csv('1')],async q=>{calls++;return {...q,total:5001,generatedAt:'2026-09-13T10:00:00Z',rows:Array.from({length:50},(_,i)=>record(i+1))};}),/OPS_PREVIEW_TOO_LARGE/);
 assert.equal(calls,1);
});
test('empty measured directory is allowed; duplicate input is rejected before reads',async()=>{
 assert.equal((await previewLocationImport(company,[csv('1')],read([]))).newCount,1);
 await assert.rejects(previewLocationImport(company,[csv('1'),csv('1')],async()=>{assert.fail('must not read');}));
});
